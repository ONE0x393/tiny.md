# tiny.md

A local-first, single-pane Markdown editor for the browser. Live mode formats the document in place and reveals Markdown punctuation on the caret or selection lines. Source mode shows the unchanged Markdown in a monospaced editor.

## Run locally

Use Node.js 22.13+ or 24 LTS.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Use `npm test` for editor regressions and `npm run build` to create the static app in `dist/`.

## What works

- Live/Source editing, undo/redo, document counts, and light/dark colors.
- In-place Markdown heading, emphasis, strikethrough, code, link, and quote formatting. Tables are styled source rows; this is not full Typora parity.
- Open UTF-8 Markdown or plain text up to 5 MB. Save downloads a Markdown copy; it does not overwrite the original. The editor normalizes line endings to LF.
- One draft per browser origin is restored on refresh, if local browser storage is available. Use Save to keep a durable copy before replacing the draft or clearing site data.
- Open with Ctrl/⌘+O and save with Ctrl/⌘+S.

Document contents stay in this browser. There is no backend, sync, or telemetry.
