#!/usr/bin/env bash
set -euo pipefail

: "${RETROSPECTIVE_TEMPLATE:?RETROSPECTIVE_TEMPLATE is required}"
: "${ORIGINAL_REQUEST:?ORIGINAL_REQUEST is required}"
: "${AVAILABLE_SKILLS:?AVAILABLE_SKILLS is required}"
: "${WORKFLOW_EVIDENCE_FILE:?WORKFLOW_EVIDENCE_FILE is required}"
: "${OUTPUT_FILE:?OUTPUT_FILE is required}"
: "${OPENCODE_BIN:?OPENCODE_BIN is required}"
: "${OPENCODE_WEB_PORT:?OPENCODE_WEB_PORT is required}"
: "${PROJECT_DIR:?PROJECT_DIR is required}"
: "${OPENCODE_SESSION_ID:?OPENCODE_SESSION_ID is required}"
: "${OPENCODE_MODEL:?OPENCODE_MODEL is required}"

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/opencode-retrospective.XXXXXX")"
trap 'rm -rf "$work_dir"' EXIT

prompt_file="$work_dir/prompt.txt"
response_file="$work_dir/session-message.json"
output_log_file="${OUTPUT_LOG_FILE:-$work_dir/opencode-retrospective.log}"

template="$(< "$RETROSPECTIVE_TEMPLATE")"
workflow_evidence="$(< "$WORKFLOW_EVIDENCE_FILE")"

# The full chat is already available in the OpenCode session. Keep only a
# bounded workflow summary in the new prompt so the follow-up stays usable.
if (( ${#workflow_evidence} > 30000 )); then
  workflow_evidence="${workflow_evidence:0:7500}

[...middle of workflow evidence omitted...]

${workflow_evidence: -22500}"
fi

prompt="${template//@ORIGINAL_REQUEST@/$ORIGINAL_REQUEST}"
prompt="${prompt//@AVAILABLE_SKILLS@/$AVAILABLE_SKILLS}"
prompt="${prompt//@WORKFLOW_EVIDENCE@/$workflow_evidence}"
prompt="${prompt//@OPENCODE_TRANSCRIPT@/The complete transcript is already in this OpenCode session. Inspect it directly, including tool calls, subagents, retries, and previous verification messages.}"
prompt="$prompt

This is a read-only retrospective follow-up inside the existing OpenCode session. Do not edit files, run implementation work, or claim completion. Return only the requested JSON object."
printf '%s\n' "$prompt" > "$prompt_file"

"$OPENCODE_BIN" run \
  --auto \
  --dangerously-skip-permissions \
  --attach "http://127.0.0.1:$OPENCODE_WEB_PORT" \
  --dir "$PROJECT_DIR" \
  --session "$OPENCODE_SESSION_ID" \
  --model "$OPENCODE_MODEL" \
  "$(< "$prompt_file")" \
  > "$output_log_file" 2>&1

curl --fail --silent --show-error \
  -H "x-opencode-directory: $PROJECT_DIR" \
  "http://127.0.0.1:$OPENCODE_WEB_PORT/session/$OPENCODE_SESSION_ID/message" \
  > "$response_file"

generated="$(jq -r '
  [.[]
   | select(.info.role == "assistant")
   | (.parts[]? | select(.type == "text") | .text)
  ] | last // empty
' "$response_file")"
generated="$(sed -e '/^[[:space:]]*```json[[:space:]]*$/d' -e '/^[[:space:]]*```[[:space:]]*$/d' <<<"$generated")"

jq -e '
  (.status == "ok") and
  (.summary_markdown | type == "string") and
  (.prompt_alignment | type == "array" and all(.[]; type == "string")) and
  (.skill_recommendations | type == "array" and all(.[];
    type == "object" and (.name | type == "string") and
    (.action | IN("add", "improve", "keep")) and
    (.reason | type == "string")
  ))
' <<<"$generated" >/dev/null

jq -c '
  {
    status: "ok",
    summary_markdown: (.summary_markdown | .[0:1200]),
    prompt_alignment: ([.prompt_alignment[] | select(type == "string") | gsub("[\\r\\n]+"; " ") | .[0:1200]] | unique | .[0:5]),
    skill_recommendations: ([.skill_recommendations[] | {
      name: (.name | gsub("[\\r\\n]+"; " ") | .[0:240]),
      action,
      reason: (.reason | gsub("[\\r\\n]+"; " ") | .[0:1200])
    }] | unique_by((.name | ascii_downcase) + "\u0000" + (.action | ascii_downcase)) | .[0:5])
  }
' <<<"$generated" > "$OUTPUT_FILE"

printf 'session=%s\nmodel=%s\noutput=%s\n' "$OPENCODE_SESSION_ID" "$OPENCODE_MODEL" "$OUTPUT_FILE"
