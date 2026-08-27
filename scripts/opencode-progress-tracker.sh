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
  if jq -e 'type == "array"' >/dev/null 2>&1 <<<"$payload" && \
    jq -e 'type == "array"' >/dev/null 2>&1 <<<"$sessions_payload"; then
    stats="$(jq -r '
      def parts: [.[].parts[]?];
      def tools: [parts[] | select(.type == "tool")];
      (tools | length)
    ' <<<"$payload")"
    tool_count="$stats"
    subagent_stats="$(jq -nr \
      --arg root "$SESSION_ID" \
      --argjson sessions "$sessions_payload" \
      '
      def descendants($all; $parent):
        [$all[] | select(.parentID == $parent)] as $children
        | ($children | map(.id)) as $ids
        | if ($ids | length) == 0 then $ids
          else $ids + ([$ids[] | descendants($all; .)] | add)
          end;
      ($sessions | descendants($sessions; $root)) as $subagents
      | ($subagents | length)
    ')"
    total_subagents="$subagent_stats"
    token_count="$(jq -nr \
      --arg root "$SESSION_ID" \
      --argjson sessions "$sessions_payload" '
      def descendants($all; $parent):
        [$all[] | select(.parentID == $parent)] as $children
        | ($children | map(.id)) as $ids
        | if ($ids | length) == 0 then $ids
          else $ids + ([$ids[] | descendants($all; .)] | add)
          end;
      ([$root] + ($sessions | descendants($sessions; $root))) as $tracked
      | reduce $sessions[] as $session (0;
          if ($tracked | index($session.id)) == null then .
          else .
            + ($session.tokens.input // 0)
            + ($session.tokens.output // 0)
            + ($session.tokens.reasoning // 0)
            + ($session.tokens.cache.read // 0)
            + ($session.tokens.cache.write // 0)
          end
        )
    ')"
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
    speed_score="$(awk -v tokens="$token_count" -v elapsed="$elapsed_seconds" \
      'BEGIN { if (elapsed > 0) printf "%.1f", tokens / elapsed; else print "0.0" }')"
    body="🟡 **OpenCode progress (live)**

Updated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')

🌐 **OpenCode Web UI:** $OPENCODE_WEB_URL

- Elapsed: ${elapsed_seconds}s
- Token count: ${token_count}
- Speed score: ${speed_score} tokens/s
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
