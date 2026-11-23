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
- Open or drag and drop one UTF-8 Markdown or plain-text file (up to 5 MB) onto the editor window. Save downloads a Markdown copy; it does not overwrite the original. The editor normalizes line endings to LF.
- One draft per browser origin is restored on refresh, if local browser storage is available. Use Save to keep a durable copy before replacing the draft or clearing site data.
- Open the Outline to jump to headings. Format selections using the toolbar or Ctrl/⌘+B/I, and toggle strikethrough or inline code from the toolbar. The theme is remembered locally.
- Use **Explorer → Open folder** or drop a folder onto the window (where browser directory drops are supported). Expand subfolders and click a Markdown or plain-text file to open it. The explorer lists supported files only, up to 5,000 input entries; folder access is session-only, and saving still downloads a copy without writing to the folder.
- Click the document name to rename it. Press Enter or click away to apply, Esc to cancel. Saving uses the new name without changing the original file on disk.
- Open with Ctrl/⌘+O and save with Ctrl/⌘+S.

Document contents stay in this browser. There is no backend, sync, or telemetry.
