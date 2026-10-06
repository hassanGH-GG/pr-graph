# PR graph

A local GitHub activity card matching the supplied poteto reference. Shows one lifetime PR total and blue bars for PRs created each month, across all states. The timeline begins in January 2023, or earlier if your history requires it.

## Run

Requires Bun, GitHub CLI, and an authenticated GitHub account.

```sh
gh auth status
bun install
bun start
```

Open http://localhost:4317. Override the port with `PORT=4318 bun start`.

The server binds to 127.0.0.1. GitHub credentials stay in the GitHub CLI; no token enters the browser. Counts include repositories your authenticated account can access. Deleted or inaccessible PRs cannot be counted.

The first sync paginates your complete authored PR history. Subsequent views use a five-minute local cache. The page updates every five minutes; the refresh button checks the server, which reuses a snapshot younger than five minutes. On a GitHub failure, a previous snapshot stays visible with a warning. The data includes no PR titles or repository names.

## Design and implementation

`public/index.html`, `public/style.css`, and `public/app.js` own the card, responsive SVG chart, keyboard-accessible monthly counts, and loading/error states. `server.js` reads the authenticated viewer's PR connection and aggregates unique PR IDs by UTC creation month. The sum must match GitHub's total before a snapshot is saved, so a partial fetch cannot appear as a complete graph.

The user's reference owns the design: white card, circular avatar, blue username, muted total, blue monthly bars, faint grid, and a right-hand scale. The screenshot's rank and settings are omitted because this is a single-account graph. No invented ranking or decorative growth claim is shown.

## Verify

```sh
bun run check
bun verify.mjs
```

With the server running and Chrome installed, verification checks live total reconciliation, desktop and mobile rendering, no horizontal overflow, monthly tooltip, refresh, error recovery, zero-PR rendering, and browser errors. Screenshots are written to `evidence/`.

GitHub API reference: https://docs.github.com/en/graphql/reference/objects#user
