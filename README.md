# Bryar 1.0 — Community Chat Starter

A responsive front-end starter for a multi-room community chat concept with an AI companion area, community principles, and future audio/video and advertising integration points.

## Current features

- Responsive desktop and mobile layout
- General, introductions, and ideas-and-projects rooms
- Create additional rooms in the current browser session
- Save your own messages locally using `localStorage`
- Local preview notice and community principles
- No external dependencies or tracking scripts

## Important limitations

This is **not yet a live multi-person chat application**. Messages are stored in the current browser only and are not sent to other users. The companion message is demo UI, not a connected AI model. Audio/video buttons are placeholders. Accounts, server-side moderation, real-time transport, AI API integration, and ad delivery are not implemented.

Do not put secrets or API keys in front-end files. A production version needs a backend, authentication, access controls, secure storage, reporting/moderation workflows, and appropriate privacy disclosures. Real-time text chat typically needs a WebSocket-capable server or managed service. Audio/video calls typically need WebRTC signaling and often a TURN service. AI and advertising integrations should be configured server-side where credentials are involved.

## Run locally

1. Extract this ZIP.
2. Open `index.html` in a modern browser, or use a local static server.
3. Send a message to test local browser storage.

Because this is a static front-end, it can be hosted with GitHub Pages for a demo. GitHub Pages will not provide the missing backend features.

## Files

- `index.html` — application structure
- `style.css` — responsive visual design
- `app.js` — front-end behavior
- `brod-chat-store.js` — local conversation storage module
- `moderation.js` — documented community principles (not an enforcement engine)

## GitHub upload

Create a repository on GitHub, extract this ZIP, then upload the files and commit them. Alternatively, push the extracted folder with Git. Do not upload credentials, API keys, or private user data.
