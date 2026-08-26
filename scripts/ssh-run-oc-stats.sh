#!/usr/bin/env bash
set -euo pipefail

repo="agents-dev/aiplay"
run_id=""
key="${HOME}/.ssh/aiplay-agentsweb"
broker_url="${BROKER_REGISTRY_URL:-https://broker.agentsweb.space/api/registrations}"
collector="$(cd "$(dirname "$0")" && pwd)/oc-runner-stats.sh"

usage() {
  echo "Usage: $0 <run-id> [--repo OWNER/REPO] [--key PATH] [--broker-url URL]" >&2
  exit 2
}

[[ $# -ge 1 ]] || usage
run_id="$1"
shift
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) repo="${2:?missing repository}"; shift 2 ;;
    --key) key="${2:?missing SSH key}"; shift 2 ;;
    --broker-url) broker_url="${2:?missing broker URL}"; shift 2 ;;
    *) usage ;;
  esac
done

[[ "$run_id" =~ ^[0-9]+$ ]] || { echo "Invalid run ID: $run_id" >&2; exit 2; }
[[ -r "$key" ]] || { echo "SSH key is not readable: $key" >&2; exit 1; }
[[ -r "$collector" ]] || { echo "Collector is not readable: $collector" >&2; exit 1; }
command -v gh >/dev/null || { echo "gh is required" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
command -v scp >/dev/null || { echo "scp is required" >&2; exit 1; }

broker_token="${BROKER_API_TOKEN:-}"
if [[ -z "$broker_token" && -f "../../sshworker/workers-dashboard/.env" ]]; then
  broker_token="$(sed -n 's/^BROKER_API_TOKEN=//p' ../../sshworker/workers-dashboard/.env | head -n 1 | tr -d '\r')"
fi

ssh_data=""
if [[ -n "$broker_token" ]]; then
  broker_json="$(curl -fsS --max-time 8 -H "Authorization: Bearer $broker_token" "$broker_url" 2>/dev/null || true)"
  ssh_data="$(jq -r --arg run "$run_id" '
    .registrations[]? | select((.run_id | tostring) == $run)
    | [.subdomain, (.public_port // .display_port // 22)] | @tsv
  ' <<<"$broker_json" 2>/dev/null | head -n 1)"
fi

if [[ -z "$ssh_data" ]]; then
  comment_data="$(gh api "repos/${repo}/issues/comments?per_page=100")"
  ssh_data="$(jq -r --arg run "actions/runs/${run_id}" '
    .[] | select(.body | contains($run)) | .body
    | capture("ssh[^\\n]*-i [^ ]+ -p (?<port>[0-9]+) runner@(?<host>[^\\n `]+)")
    | [.host, .port] | @tsv
  ' <<<"$comment_data" | tail -n 1)"
fi

if [[ -z "$ssh_data" ]]; then
  echo "No temporary SSH command found for run ${run_id}." >&2
  exit 1
fi

IFS=$'\t' read -r host port <<<"$ssh_data"
[[ "$host" == *.* ]] || host="${host}.agentsweb.space"
ssh_opts=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=20 -i "$key" -p "$port")
scp_opts=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=20 -i "$key" -P "$port")
remote="runner@${host}"
remote_collector="/tmp/aiplay-oc-stats-${run_id}.sh"

cleanup() {
  ssh "${ssh_opts[@]}" "$remote" "rm -f '$remote_collector'" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Collecting OpenCode stats on ${host}:${port}" >&2
scp "${scp_opts[@]}" "$collector" "${remote}:${remote_collector}" >/dev/null
ssh "${ssh_opts[@]}" "$remote" "chmod 700 '$remote_collector' && '$remote_collector'"
