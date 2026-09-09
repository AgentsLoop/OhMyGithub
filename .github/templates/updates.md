# Worker instructions

You are building the app or game requested in the triggering GitHub issue. Work only
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
- one screenshot showing the latest newly completed UI or gameplay milestone.

Save milestone screenshots under `screenshots/`. Do not commit screenshots.
The workflow uploads final screenshots to the run release and publishes their
immutable release URLs in the completion comment.

```text
https://github.com/$GITHUB_REPOSITORY/releases/download/<release-tag>/<file-name>
```

Embed the screenshot in an expandable block in the same progress comment:

```html
<details>
<summary>Screenshot</summary>
<img src="https://github.com/$GITHUB_REPOSITORY/releases/download/<release-tag>/<file-name>" alt="Description of the visible milestone">
</details>
```

Use only one screenshot per progress comment when a release URL is available.
Never claim a UI or gameplay milestone is complete without opening the running
game and capturing visible evidence.

## Completion requirements

Before declaring the game complete:

1. Run the relevant tests and verify the playable game in a real browser.
2. Capture final screenshots of the playable game and save them under
   `screenshots/` using names beginning with `final-`.
3. Leave final screenshots uncommitted for the workflow to upload to the release.
4. Post a final issue comment containing:
   - a concise summary of the completed game;
   - the public game link;
   - the final commit link;
   - deployment and test status;
   - known limitations (write `None` when there are none);
   - final screenshots embedded in expandable blocks in the comment.

The workflow publishes a completion comment from the released evidence.
The workflow owns the final immutable branch commit and project link.
