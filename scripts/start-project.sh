#!/usr/bin/env bash
# Start the saved project and publish readiness only after both HTTP checks pass.
set -euo pipefail
cd "${PROJECT_DIR:?}"
: "${OPENCODE_WEB_DIR:?}" "${APP_URL:?}"
PORT="${APP_PORT:-3000}"
export PORT
/usr/bin/time -p test -f start.sh
/usr/bin/time -p bash -n start.sh
if [[ "${RESTART_APP:-false}" == true ]] || ! /usr/bin/time -p curl --fail --silent --max-time 3 "http://127.0.0.1:$PORT/" >/dev/null; then
  /usr/bin/time -p tmux kill-session -t app-server 2>/dev/null || true
  # Pass paths through tmux's environment; keep the script in the foreground.
  /usr/bin/time -p tmux new-session -d -s app-server -c "$PROJECT_DIR" \
    -e "RUNTIME_DIR=${RUNTIME_DIR:?}" -e "OPENCODE_WEB_DIR=$OPENCODE_WEB_DIR" -e "PORT=$PORT" -e "STARTUP_LOG=$OPENCODE_WEB_DIR/app.log" \
    'bash start.sh > "$STARTUP_LOG" 2>&1'
fi
ready=false
for ((attempt=0; attempt<30; attempt++)); do
  if /usr/bin/time -p curl --fail --silent --max-time 3 "http://127.0.0.1:$PORT/" >/dev/null; then
    ready=true
    break
  fi
  /usr/bin/time -p tmux has-session -t app-server 2>/dev/null || { echo 'Startup process exited. Inspect app.log.' >&2; exit 1; }
  /usr/bin/time -p sleep 2
done
[[ "$ready" == true ]] || { echo 'Local startup failed. Inspect app.log.' >&2; exit 75; }
for ((attempt=0; attempt<12; attempt++)); do
  if /usr/bin/time -p curl --fail --silent --max-time 10 "$APP_URL" >/dev/null; then
    echo 'Local and public preview are ready.'
    exit 0
  fi
  /usr/bin/time -p sleep 2
done
echo 'Public preview did not become ready.' >&2
exit 75
