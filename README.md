# Bryar 1.0 — Stages 2–5 Starter

This ZIP extends the static preview into a Node.js full-stack starter for:
- **Stage 2:** accounts, session login, SQLite persistence, shared rooms, and real-time text chat with Socket.IO.
- **Stage 3:** Bryar Companion endpoint backed by an OpenAI-compatible chat-completions API, with server-side API key and a basic safety-oriented system prompt.
- **Stage 4:** WebRTC audio/video call signaling, consent-before-answer UI, local/remote video, and hang-up. This is a foundation, not a production-tested group-call service.
- **Stage 5:** optional advertising placement and an opt-in external ad script configuration. No ad network is included or activated by default.

## Run locally

Requires Node.js 20 or newer.

1. Extract this folder.
2. Copy `.env.example` to `.env`.
3. Set a long random `SESSION_SECRET`. Add `AI_API_KEY` if you want connected AI.
4. In this folder run:
   ```bash
   npm install
   npm start
   ```
5. Open `http://localhost:3000`.

For a first test, create two accounts in two separate browser profiles/devices and join the same room. On a phone, microphone/camera permissions generally require HTTPS; `localhost` is treated specially by browsers. To test across the internet, deploy to a Node-capable host with HTTPS and persistent disk.

## GitHub upload

Upload the contents of this folder to your repository. **Do not upload `.env`, `node_modules`, or `data/`.** `.gitignore` excludes these. GitHub Pages cannot run `server.js`; deploy the Node server to a host that supports long-running Node applications.

## Important limits before public launch

This is a runnable starter, not a fully audited production service.

- **Calls:** current signaling is room-broadcast based and is suitable only for basic peer-to-peer tests. It does not implement a robust group-call mesh, call invitations/ringing, collision handling, reconnection, or a TURN server. For reliable calls across networks, configure a paid/reliable TURN service and consider an SFU such as LiveKit, mediasoup, or a managed video provider. Never treat this as production-ready group video.
- **Security/moderation:** before public use, add email verification, password reset, CSRF protection, account deletion/export, reporting/blocking, moderator/admin tools, spam controls, content retention rules, privacy policy, terms, and a security review. Basic safety prompt is not a guarantee.
- **AI:** configure a provider and monitor costs. Do not expose the AI key to browser code. Review provider privacy/data retention terms.
- **Advertising:** `ADS_ENABLED` defaults to `false`. No ad network account or revenue is included. Choose a provider, follow its policies, implement consent/age/privacy disclosures where required, and validate any script URL before enabling it.
- **Deployment:** use HTTPS, secure environment secrets, persistent storage, backups, monitoring, rate limits, and a database appropriate to your scale. SQLite works for small tests; use managed Postgres for serious production use.
- **Data:** user passwords are hashed with bcrypt. Chat history is stored in `data/bryar.sqlite` on the server. This is not end-to-end encrypted.

## Project map

- `server.js` — HTTP API, authentication, database, Socket.IO, AI proxy, call signaling.
- `public/index.html` — UI and controls.
- `public/style.css` — responsive dark interface.
- `public/app.js` — browser client.
- `.env.example` — environment variable template.
- `.gitignore` — excludes secrets, local database and dependencies.

## Build order

1. Stage 2: deploy backend + test accounts and real-time chat.
2. Stage 3: set `AI_API_KEY` and validate the model/provider.
3. Stage 4: configure TURN or use a managed calling provider; test on multiple networks and devices.
4. Stage 5: select and review an ad provider, then enable ads only after policy/privacy setup.
