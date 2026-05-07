# TelePrompter

TelePrompter is a browser-based teleprompter for live reading, editing, and simple script playback.

Live app:

[https://jk-verma.github.io/teleprompter/](https://jk-verma.github.io/teleprompter/)

## What it does

- Edits rich-text script content directly in the page
- Remembers the latest script in browser memory
- Supports plain text, HTML, Markdown, and JSON file import
- Lets you adjust font size, scroll speed, margin, text color, and background color
- Provides alignment controls for the current sentence or selected text
- Includes Play, mic, fullscreen, open, save, reset, and README controls in the header

## How to use it

Open the app, type or paste your script, and use the toolbar to tune the reading experience. The Play button scrolls the script vertically. The mic button enables speech processing when your browser supports it. You can also open a local file, edit it in place, and save the current script back out from the toolbar.

## File import

Supported file types include:

- `.txt`
- `.md`
- `.html`
- `.htm`
- `.json`

HTML imports keep the document body when possible. Plain text and Markdown are converted into readable paragraph blocks. JSON imports look for common script fields such as `html`, `content`, `text`, and `scriptHtml`.

## Keyboard shortcuts

While editing and reading, the app supports standard formatting shortcuts such as bold, italic, and underline, along with navigation keys for script playback.

## Notes

- The README view inside the app mirrors this file.
- Speech recognition behavior depends on the browser, and Chrome is recommended.
