# Keep Codex execution and terminal access on one server

Run one Codex app server per issue. Attach the controller and remote TUI to
that server. Use turn completion events to advance the workflow. Avoid parsing
terminal output to infer completion. Preserve the build task, fork validation,
and move the terminal to that fork before validation starts.

Pin the CLI version for both clients. Keep terminal reconnects inside tmux.
Close the editable terminal during the final Git snapshot and reopen it after
publishing. Keep the access hold within the runner timeout.
