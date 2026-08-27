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
- links to the current commit and any available public preview. The
  repository-root workflow publishes the isolated worktree with its
  validated controlled push;
- one screenshot showing the latest newly completed UI or gameplay milestone.

Save milestone screenshots under `screenshots/`. Before embedding one in an
issue comment, commit it in the isolated worktree and use an immutable URL
after the repository-root workflow publishes it in this form:

```text
https://raw.githubusercontent.com/$GITHUB_REPOSITORY/<commit-sha>/project/screenshots/<file-name>
```

Embed the screenshot in an expandable block in the same progress comment:

```html
<details>
  <summary>Screenshot</summary>
  <img
    src="https://raw.githubusercontent.com/$GITHUB_REPOSITORY/<commit-sha>/project/screenshots/<file-name>"
    alt="Description of the visible milestone"
  />
</details>
```

Use only one screenshot per progress comment. Never claim a UI or gameplay
milestone is complete without opening the running game and capturing visible
evidence.

## Completion requirements

Before declaring the game complete:

1. Run the relevant tests and verify the playable game in a real browser.
2. Capture final screenshots of the playable game and save them under
   `screenshots/` using names beginning with `final-`.
3. Commit all final code and screenshots in the isolated worktree. Do not push;
   the repository-root workflow owns the validated controlled push.
4. Post a final issue comment containing:
   - a concise summary of the completed game;
   - the public game link;
   - the final commit link;
   - deployment and test status;
   - known limitations (write `None` when there are none);
   - final screenshots embedded in expandable blocks in the comment.

The workflow may also publish a completion comment from the committed evidence.
Do not create a pull request yourself; the workflow owns pull-request creation.
