#!/usr/bin/env bash
set -euo pipefail

: "${RETROSPECTIVE_TEMPLATE:?RETROSPECTIVE_TEMPLATE is required}"
: "${ORIGINAL_REQUEST:?ORIGINAL_REQUEST is required}"
: "${AVAILABLE_SKILLS:?AVAILABLE_SKILLS is required}"
: "${WORKFLOW_EVIDENCE_FILE:?WORKFLOW_EVIDENCE_FILE is required}"
: "${OPENCODE_TRANSCRIPT_FILE:?OPENCODE_TRANSCRIPT_FILE is required}"
: "${OUTPUT_FILE:?OUTPUT_FILE is required}"

ZEN_URL="${OPENCODE_ZEN_URL:-https://opencode.ai/zen/v1}"
MODEL_PREFERENCE="${OPENCODE_ZEN_MODEL:-muse-spark-1.3-contributor-free}"
REQUEST_ID="req_retrospective_$(date +%s)_$$"
work_dir="$(mktemp -d "${TMPDIR:-/tmp}/opencode-retrospective.XXXXXX")"
trap 'rm -rf "$work_dir"' EXIT

models_file="$work_dir/models.json"
response_file="$work_dir/response.json"
request_file="$work_dir/request.json"

curl --fail --silent --show-error --max-time 30 \
  -H 'Authorization: Bearer public' \
  -H 'User-Agent: opencode/1.4.3' \
  -H 'X-Opencode-Client: cli' \
  -H 'X-Opencode-Project: global' \
  -H "X-Opencode-Request: $REQUEST_ID" \
  "$ZEN_URL/models" > "$models_file"

model="$(jq -r --arg preferred "$MODEL_PREFERENCE" '
  [.data[]?.id // empty] as $ids
  | if ($ids | index($preferred)) then $preferred
    else ($ids | map(select(endswith("-free"))) | .[0] // empty)
    end
' "$models_file")"
if [[ -z "$model" ]]; then
  echo 'OpenCode Zen returned no usable free model.' >&2
  exit 1
fi

template="$(< "$RETROSPECTIVE_TEMPLATE")"
workflow_evidence="$(< "$WORKFLOW_EVIDENCE_FILE")"
opencode_transcript="$(< "$OPENCODE_TRANSCRIPT_FILE")"
prompt="${template//@ORIGINAL_REQUEST@/$ORIGINAL_REQUEST}"
prompt="${prompt//@AVAILABLE_SKILLS@/$AVAILABLE_SKILLS}"
prompt="${prompt//@WORKFLOW_EVIDENCE@/$workflow_evidence}"
prompt="${prompt//@OPENCODE_TRANSCRIPT@/$opencode_transcript}"

jq -n \
  --arg model "$model" \
  --arg prompt "$prompt" \
  '{model: $model, input: [{role: "user", content: [{type: "input_text", text: $prompt}]}], stream: false, store: false}' \
  > "$request_file"

http_code="$(curl --silent --show-error --max-time 180 \
  -o "$response_file" \
  -w '%{http_code}' \
  -X POST \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer public' \
  -H 'User-Agent: opencode/1.4.3' \
  -H 'X-Opencode-Client: cli' \
  -H 'X-Opencode-Project: global' \
  -H "X-Opencode-Request: $REQUEST_ID" \
  --data-binary "@$request_file" \
  "$ZEN_URL/responses")"

if [[ ! "$http_code" =~ ^2 ]]; then
  echo "OpenCode Zen returned HTTP $http_code:" >&2
  sed -n '1,120p' "$response_file" >&2
  exit 1
fi

generated="$(jq -r '
  if (.output_text? | type) == "string" then .output_text
  else ([.output[]?.content[]? | select(.type == "output_text") | .text] | join("\n\n"))
  end
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
    prompt_alignment: ([.prompt_alignment[] | select(type == "string") | .[0:1200]] | unique | .[0:5]),
    skill_recommendations: ([.skill_recommendations[] | {
      name: (.name | .[0:240]),
      action,
      reason: (.reason | .[0:1200])
    }] | unique_by((.name | ascii_downcase) + "\u0000" + (.action | ascii_downcase)) | .[0:5])
  }
' <<<"$generated" > "$OUTPUT_FILE"

printf 'model=%s\nrequest_id=%s\noutput=%s\n' "$model" "$REQUEST_ID" "$OUTPUT_FILE"
