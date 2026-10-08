# ChatGPT Chat Finder

ChatGPT's UI never shows you what time you had a conversation. This is a tiny Chrome extension that lists **all** your ChatGPT conversations grouped by date, with the exact time next to each title — and a **Refresh** button to pull in anything new.

Everything runs locally in your browser using your own logged-in ChatGPT session. Nothing is sent to any third-party server; the chat list is cached only in your browser's local extension storage.

## Features

- Every chat's exact **time** shown next to its title
- Grouped by **create date**, newest first
- **Refresh button** — re-fetches the latest chats from ChatGPT on demand (uses whichever `chatgpt.com` tab you already have open, or opens one quietly in the background if needed)
- Click any row to open that conversation directly in a new tab
- Local cache persists between popup opens, so you're not re-fetching every time

## Install

Not on the Chrome Web Store — load it as an unpacked extension:

1. Clone this repo
   ```bash
   git clone https://github.com/vibhorpahare/chatgpt-chat-finder.git
   ```
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `chatgpt-chat-finder` folder
5. Pin the extension icon to your toolbar

## Usage

1. Make sure you're logged into [chatgpt.com](https://chatgpt.com) in some tab (or just let the extension open one for you)
2. Click the extension icon
3. Hit **Refresh** to sync your chat list
4. Scroll the date-grouped list — each row shows the time the chat started
5. Click any chat to open it in a new tab

## How it works

- `popup.js`'s Refresh button finds (or opens) a `chatgpt.com` tab and injects a script into it via `chrome.scripting.executeScript`
- That injected script runs **inside the ChatGPT page's own context**, so it reuses your existing session — it reads your access token from `/api/auth/session` and paginates `GET /backend-api/conversations` until every conversation is collected
- The result (id, title, created/updated timestamps) is passed back to the popup and cached in `chrome.storage.local`
- Dates/times are rendered in your browser's local timezone

## Permissions

- `storage` — cache your chat list locally so the popup opens instantly
- `scripting` + `host_permissions` for `chatgpt.com` — inject the fetch script into the ChatGPT tab
- `tabs` — find/open/close the `chatgpt.com` tab used for syncing

## Tech

- Manifest V3, no build step, no external dependencies

## License

MIT — see [LICENSE](LICENSE).
