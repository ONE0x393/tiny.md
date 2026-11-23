# tiny.md

A local-first, single-pane Markdown editor for the browser. Live mode formats the document in place and reveals Markdown punctuation on the caret or selection lines. Source mode shows the unchanged Markdown in a monospaced editor.

## Run locally

Use Node.js 22.13+ or 24 LTS.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Use `npm test` for editor regressions and `npm run build` to create the static app in `dist/`.

The first milestone includes headings, emphasis, strikethrough, inline code, links, blockquotes, code fences, Markdown list handling, undo/redo, document counts, and light/dark colors. Tables display as styled source rows in Live; this is not full Typora parity. Document contents are not sent anywhere. This milestone has no draft storage or file I/O yet.
