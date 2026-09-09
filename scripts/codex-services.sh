#!/usr/bin/env bash
set -euo pipefail
# Measure each external setup command. Do not print arguments containing secrets.
timed() {
  local label="$1"
  shift
  local started=$SECONDS code=0
  "$@" || code=$?
  printf '%s: %ss\n' "$label" "$((SECONDS-started))" >&2
  return "$code"
}
state="$CODEX_STATE_DIR"
if [[ "${1:-start}" == cleanup ]]; then
  set +e
  for pidfile in "$state"/*.pid; do
    [[ -f "$pidfile" ]] || continue
    timed stop-process kill "$(cat "$pidfile")"
  done
  timed stop-codex-terminal tmux kill-session -t codex
  timed stop-app tmux kill-session -t app-server
  [[ ! -f "$state/sshd.pid" ]] || timed stop-sshd sudo kill "$(cat "$state/sshd.pid")"
  timed remove-state rm -rf "$state"
  exit 0
fi
printf '%s\n' "$(date +%s)" >> "$RUNNER_TEMP/codex-started"
timed create-state mkdir -p "$state" "$CODEX_HOME"
timed protect-state chmod 700 "$state" "$CODEX_HOME"
if [[ "$TEST_REQUEST" == true ]]; then exit 0; fi
[[ -n "${CODEX_AUTH_CONTENT:-}" ]] || { echo 'Set CODEX_AUTH_JSON before running Codex.' >&2; exit 1; }
printf '%s' "$CODEX_AUTH_CONTENT" > "$CODEX_HOME/auth.json"
timed protect-auth chmod 600 "$CODEX_HOME/auth.json"
unset CODEX_AUTH_CONTENT
timed install-codex npm install --global @openai/codex@0.147.0
if [[ "$RUNNER_OS" == Linux ]]; then
  timed apt-update sudo apt-get update
  timed install-terminal sudo apt-get install -y ttyd tmux openssh-server
  timed download-cloudflared curl -fsSL --retry 3 https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o "$state/cloudflared"
  timed install-cloudflared chmod 755 "$state/cloudflared"
  printf '%s\n' "$state" >> "$GITHUB_PATH"
  export PATH="$state:$PATH"
else
  timed install-terminal brew install ttyd tmux cloudflared
fi
timed check-login codex login status
nohup codex app-server --listen "$CODEX_ENDPOINT" > "$state/app-server.log" 2>&1 &
printf '%s' "$!" > "$state/app-server.pid"
for ((attempt=0; attempt<60; attempt++)); do
  if timed app-server-ready nc -z 127.0.0.1 4097; then break; fi
  [[ "$attempt" -lt 59 ]] || { echo 'Codex server did not start.' >&2; exit 1; }
  timed server-wait sleep 1
done
# Each browser connection attaches to the persistent tmux client.
cat > "$state/attach.sh" <<'ATTACH'
#!/usr/bin/env bash
set -euo pipefail
while ! /usr/bin/time -p tmux has-session -t codex 2>/dev/null; do /usr/bin/time -p sleep 1; done
exec tmux attach-session -t codex
ATTACH
timed enable-attach chmod 700 "$state/attach.sh"
terminal_args=(-i 127.0.0.1 -p 7681 -W -O)
if [[ -n "${CODEX_WEB_CREDENTIAL:-}" ]]; then
  [[ "$CODEX_WEB_CREDENTIAL" == *:* ]] || { echo 'Set CODEX_WEB_CREDENTIAL to username:password.' >&2; exit 1; }
  terminal_args+=(-c "$CODEX_WEB_CREDENTIAL")
fi
nohup ttyd "${terminal_args[@]}" "$state/attach.sh" > "$state/terminal.log" 2>&1 &
printf '%s' "$!" > "$state/terminal.pid"
nohup cloudflared tunnel --no-autoupdate --url http://127.0.0.1:7681 > "$state/terminal-tunnel.log" 2>&1 &
printf '%s' "$!" > "$state/terminal-tunnel.pid"
for ((attempt=0; attempt<90; attempt++)); do
  url="$(sed -nE 's#.*(https://[a-z0-9-]+\.trycloudflare\.com).*#\1#p' "$state/terminal-tunnel.log" | head -n 1)"
  if [[ -n "$url" ]]; then
    curl_args=(--fail --silent --show-error --max-time 10)
    [[ -z "${CODEX_WEB_CREDENTIAL:-}" ]] || curl_args+=(--user "$CODEX_WEB_CREDENTIAL")
    if timed terminal-ready curl "${curl_args[@]}" "$url" -o /dev/null; then
      printf '%s' "$url" > "$state/terminal-url"
      break
    fi
  fi
  [[ "$attempt" -lt 89 ]] || { echo 'Browser terminal did not become available.' >&2; exit 1; }
  timed terminal-wait sleep 2
done
start_ssh() {
  timed generate-ssh-key ssh-keygen -t ed25519 -f "$state/ssh-key" -N '' -q
  { cat "$state/ssh-key.pub"; printf '\n%s\n' "$AGENTSWEB_PUBLIC_KEY"; } > "$state/authorized_keys"
  timed protect-ssh-key chmod 600 "$state/authorized_keys"
  [[ "$RUNNER_OS" != Linux ]] || timed ssh-runtime sudo mkdir -p /run/sshd
  sudo /usr/sbin/sshd -D -e -p 2222 -o PasswordAuthentication=no -o PermitRootLogin=no \
    -o PubkeyAuthentication=yes -o "AuthorizedKeysFile=$state/authorized_keys" > "$state/sshd.log" 2>&1 &
  printf '%s' "$!" > "$state/sshd.pid"
  nohup env PYTHONPATH="$GITHUB_WORKSPACE/.agentsweb" python3 -m lolgames_tunnel client 127.0.0.1:2222 \
    --server agentsweb.space --name "codex-issue-$TRIGGER_ISSUE_NUMBER-$GITHUB_RUN_ID-ssh" \
    --public-port "$((32000 + GITHUB_RUN_ID % 1000))" > "$state/ssh-tunnel.log" 2>&1 &
  printf '%s' "$!" > "$state/ssh-tunnel.pid"
  local endpoint host port attempt
  for ((attempt=0; attempt<45; attempt++)); do
    endpoint="$(sed -nE 's#^ssh://([^:[:space:]]+):([0-9]+).*$#\1 \2#p' "$state/ssh-tunnel.log" | head -n 1)"
    if [[ -n "$endpoint" ]]; then
      read -r host port <<< "$endpoint"
      if timed ssh-ready ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        -o BatchMode=yes -o ConnectTimeout=5 -i "$state/ssh-key" -p "$port" "$(whoami)@$host" true; then
        printf 'ssh -i ~/.ssh/aiplay-agentsweb -p %s %s@%s\n' "$port" "$(whoami)" "$host" > "$state/ssh-command"
        return 0
      fi
    fi
    timed ssh-wait sleep 2
  done
  return 1
}
if [[ -n "${AGENTSWEB_PUBLIC_KEY:-}" ]]; then
  start_ssh || echo 'Optional AgentsWeb SSH is unavailable; browser terminal is ready.'
fi
