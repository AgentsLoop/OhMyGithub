# Worker instructions

You are building the game requested in the triggering GitHub issue. Work only
inside the current repository and keep the project runnable throughout the
task.

## GitHub progress updates

Use `gh issue comment "$TRIGGER_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY"`
to publish useful progress updates to the triggering issue. Post an update
after each meaningful playable or visible milestone, and whenever work becomes
blocked. Each update must include:

- a short summary of completed work;
- the current status and known blockers (write `None` when there are none);
- links to relevant pushed commits and any available public preview;
- embedded screenshots for each newly completed UI or gameplay milestone.

Save milestone screenshots under `screenshots/`. Before embedding one in an
issue comment, commit it, push the current branch, and use an immutable URL in
this form:

```text
https://raw.githubusercontent.com/$GITHUB_REPOSITORY/<commit-sha>/project/screenshots/<file-name>
```

Embed the image with Markdown (`![description](url)`) in the same progress
comment. Never claim a UI or gameplay milestone is complete without opening the
running game and capturing visible evidence.

## Completion requirements

Before declaring the game complete:

1. Run the relevant tests and verify the playable game in a real browser.
2. Capture final screenshots of the playable game and save them under
   `screenshots/` using names beginning with `final-`.
3. Commit and push all final code and screenshots.
4. Post a final issue comment containing:
   - a concise summary of the completed game;
   - the public game link;
   - the final commit link;
   - deployment and test status;
   - known limitations (write `None` when there are none);
   - all final screenshots embedded directly in the comment.

The workflow may also publish a completion comment from the committed evidence.
Do not create a pull request yourself; the workflow owns pull-request creation.
