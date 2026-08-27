#!/usr/bin/env bash
set -euo pipefail

started_at="$(date +%s)"

vision_calls() {
  jq -r '
    def has_image($message):
      any((($message.parts // [])[]?);
        (.type == "file" and ((.mime // .mediaType // "") | startswith("image/"))) or
        (.type == "tool" and any(((.state.attachments // [])[]?.mime?); ((. // "") | startswith("image/"))))
      );
    reduce .[] as $message ({ seen: false, calls: 0 };
      if $message.info.role == "assistant" then
        .calls += (if .seen then 1 else 0 end)
        | .seen = (.seen or has_image($message))
      else
        .seen = (.seen or has_image($message))
      end
    ) | .calls
  '
}

while :; do
  payload="$(curl --fail --silent --show-error \
    -H "x-opencode-directory: $PROJECT_DIR" \
    "http://127.0.0.1:$OPENCODE_WEB_PORT/session/$SESSION_ID/message" 2>/dev/null || true)"
  sessions_payload="$(curl --fail --silent --show-error \
    -H "x-opencode-directory: $PROJECT_DIR" \
    "http://127.0.0.1:$OPENCODE_WEB_PORT/session" 2>/dev/null || true)"
  status_payload="$(curl --fail --silent --show-error \
    -H "x-opencode-directory: $PROJECT_DIR" \
    "http://127.0.0.1:$OPENCODE_WEB_PORT/session/status" 2>/dev/null || true)"
  if jq -e 'type == "array"' >/dev/null 2>&1 <<<"$payload" && \
    jq -e 'type == "array"' >/dev/null 2>&1 <<<"$sessions_payload" && \
    jq -e 'type == "object"' >/dev/null 2>&1 <<<"$status_payload"; then
    stats="$(jq -r '
      def parts: [.[].parts[]?];
      def tools: [parts[] | select(.type == "tool")];
      [
        (tools | length),
        ([tools[] | select(.state.status == "running" or .state.status == "pending")] | length)
      ] | @tsv
    ' <<<"$payload")"
    IFS=$'\t' read -r tool_count active_count <<<"$stats"
    subagent_stats="$(jq -nr \
      --arg root "$SESSION_ID" \
      --argjson sessions "$sessions_payload" \
      --argjson statuses "$status_payload" '
      def descendants($all; $parent):
        [$all[] | select(.parentID == $parent)] as $children
        | ($children | map(.id)) as $ids
        | if ($ids | length) == 0 then $ids
          else $ids + ([$ids[] | descendants($all; .)] | add)
          end;
      ($sessions | descendants($sessions; $root)) as $subagents
      | {
          total: ($subagents | length),
          active: ([$statuses | to_entries[]
            | select((.key as $id | ($subagents | index($id))) != null)
            | select(.value.type != "idle")
          ] | length)
        }
      | [.active, .total] | @tsv
    ')"
    IFS=$'\t' read -r active_subagents total_subagents <<<"$subagent_stats"
    subagent_ids="$(jq -nr \
      --arg root "$SESSION_ID" \
      --argjson sessions "$sessions_payload" '
      def descendants($all; $parent):
        [$all[] | select(.parentID == $parent)] as $children
        | ($children | map(.id)) as $ids
        | if ($ids | length) == 0 then $ids
          else $ids + ([$ids[] | descendants($all; .)] | add)
          end;
      ($sessions | descendants($sessions; $root))[]
    ')"
    vision_count="$(vision_calls <<<"$payload")"
    while IFS= read -r subagent_id; do
      [[ -n "$subagent_id" ]] || continue
      subagent_payload="$(curl --fail --silent --show-error \
        -H "x-opencode-directory: $PROJECT_DIR" \
        "http://127.0.0.1:$OPENCODE_WEB_PORT/session/$subagent_id/message" 2>/dev/null || true)"
      if jq -e 'type == "array"' >/dev/null 2>&1 <<<"$subagent_payload"; then
        subagent_vision_count="$(vision_calls <<<"$subagent_payload")"
        vision_count=$((vision_count + subagent_vision_count))
      fi
    done <<<"$subagent_ids"
    changed_count="$(git -C "$PROJECT_DIR" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
    elapsed_seconds="$(( $(date +%s) - started_at ))"
    body="🟡 **OpenCode progress (live)**

Updated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')

🌐 **OpenCode Web UI:** $OPENCODE_WEB_URL

- Elapsed: ${elapsed_seconds}s
- Tool calls: $tool_count
- Active tool calls: $active_count
- Active subagents: $active_subagents
- Total subagents executed: $total_subagents
- Image-context model calls: $vision_count
- Changed workspace files: $changed_count

_Image-context model calls are inferred from image attachments in the session transcript. Message contents and tool details are hidden. Full logs are published in the completion release._"
    if [[ "${PROGRESS_DRY_RUN:-false}" == "true" ]]; then
      printf '%s\n' "$body" > "${PROGRESS_OUTPUT:?PROGRESS_OUTPUT is required in dry-run mode}"
    else
      gh api --method PATCH "repos/$REPOSITORY/issues/comments/$COMMENT_ID" \
        -f body="$body" >/dev/null || true
    fi
  fi
  [[ -f "$OPENCODE_WEB_DIR/response-comment.done" ]] && break
  sleep 10
done
