#!/bin/bash
set -euo pipefail
exec codex resume --remote "$CODEX_ENDPOINT" "$CODEX_THREAD"
