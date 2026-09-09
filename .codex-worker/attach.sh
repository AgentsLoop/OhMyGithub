#!/usr/bin/env bash
set -euo pipefail
while ! /usr/bin/time -p tmux has-session -t codex 2>/dev/null; do /usr/bin/time -p sleep 1; done
exec tmux attach-session -t codex
