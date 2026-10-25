require("dotenv").config();
const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const session = require("express-session");
const SQLiteStoreFactory = require("connect-sqlite3");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "bryar.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT NOT NULL,
    username TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const SQLiteStore = SQLiteStoreFactory(session);
const sessionMiddleware = session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: dataDir }),
  secret: process.env.SESSION_SECRET || "development-only-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: isProduction, maxAge: 7 * 24 * 60 * 60 * 1000 }
});
if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  console.error("Set SESSION_SECRET to a random value of at least 32 characters before production.");
  process.exit(1);
}
app.use(helmet({ contentSecurityPolicy: false })); // CSP must be tailored before production.
app.use(express.json({ limit: "20kb" }));
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, "public")));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

function cleanUsername(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_]{3,24}$/.test(value) ? value : null;
}
function cleanRoom(value) {
  if (typeof value !== "string") return null;
  const room = value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
  return room.length >= 2 ? room : null;
}
function requireUser(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Sign in first." });
  next();
}
function safeUser(user) { return { id: user.id, username: user.username }; }

app.get("/api/config", (req, res) => {
  res.json({
    aiAvailable: Boolean(process.env.AI_API_KEY),
    adsEnabled: process.env.ADS_ENABLED === "true",
    adScriptUrl: process.env.ADS_ENABLED === "true" && /^https:\/\//.test(process.env.AD_SCRIPT_URL || "") ? process.env.AD_SCRIPT_URL : "",
    stunUrl: process.env.STUN_URL || "stun:stun.l.google.com:19302",
    user: req.session.user || null
  });
});
app.post("/api/register", rateLimit({ windowMs: 15 * 60_000, limit: 10 }), async (req, res) => {
  const username = cleanUsername(req.body?.username);
  const password = req.body?.password;
  if (!username) return res.status(400).json({ error: "Username must be 3–24 letters, numbers, or underscores." });
  if (typeof password !== "string" || password.length < 10 || password.length > 200) {
    return res.status(400).json({ error: "Password must be 10–200 characters." });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, hash);
    req.session.user = { id: Number(result.lastInsertRowid), username };
    res.json({ user: req.session.user });
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) return res.status(409).json({ error: "That username is already taken." });
    res.status(500).json({ error: "Could not create account." });
  }
});
app.post("/api/login", rateLimit({ windowMs: 15 * 60_000, limit: 20 }), async (req, res) => {
  const username = cleanUsername(req.body?.username);
  const password = req.body?.password;
  if (!username || typeof password !== "string") return res.status(400).json({ error: "Enter your username and password." });
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: "Incorrect username or password." });
  req.session.user = safeUser(user);
  res.json({ user: req.session.user });
});
app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get("/api/me", (req, res) => res.json({ user: req.session.user || null }));
app.get("/api/rooms/:room/messages", requireUser, (req, res) => {
  const room = cleanRoom(req.params.room);
  if (!room) return res.status(400).json({ error: "Invalid room name." });
  const messages = db.prepare("SELECT id, room, username, body, created_at AS createdAt FROM messages WHERE room = ? ORDER BY id DESC LIMIT 100").all(room).reverse();
  res.json({ messages });
});
app.post("/api/ai", requireUser, rateLimit({ windowMs: 60_000, limit: 15 }), async (req, res) => {
  if (!process.env.AI_API_KEY) return res.status(503).json({ error: "AI is not configured yet. Add AI_API_KEY to your server environment." });
  const prompt = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 4000) : "";
  const room = cleanRoom(req.body?.room || "general");
  if (!prompt || !room) return res.status(400).json({ error: "Enter a message and valid room." });
  const system = `You are Bryar Companion, a helpful assistant in a public community room. Be respectful, honest about being AI, protect privacy, do not facilitate harm, harassment, or illegal activity. Encourage users to contact moderators for urgent safety issues. You are not a human moderator and cannot guarantee safety.`;
  try {
    const response = await fetch(process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4o-mini",
        messages: [{ role: "system", content: system }, { role: "user", content: `Room: #${room}\nUser message: ${prompt}` }],
        max_tokens: 500,
        temperature: 0.6
      }),
      signal: AbortSignal.timeout(30000)
    });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: "AI provider request failed. Check server logs and AI configuration." });
    const reply = data.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) return res.status(502).json({ error: "AI provider returned no response." });
    res.json({ reply: reply.trim() });
  } catch (e) {
    res.status(502).json({ error: "Could not reach the AI provider." });
  }
});

io.use((socket, next) => sessionMiddleware(socket.request, {}, next));
io.use((socket, next) => {
  if (!socket.request.session?.user) return next(new Error("Sign in to join chat."));
  socket.user = socket.request.session.user;
  next();
});
io.on("connection", socket => {
  socket.on("room:join", async (rawRoom, callback) => {
    const room = cleanRoom(rawRoom);
    if (!room) return typeof callback === "function" && callback({ error: "Invalid room name." });
    for (const oldRoom of socket.rooms) if (oldRoom !== socket.id) socket.leave(oldRoom);
    socket.join(room);
    const history = db.prepare("SELECT id, room, username, body, created_at AS createdAt FROM messages WHERE room = ? ORDER BY id DESC LIMIT 100").all(room).reverse();
    socket.emit("room:history", history);
    socket.to(room).emit("presence", { username: socket.user.username, state: "joined" });
    if (typeof callback === "function") callback({ ok: true, room });
  });
  socket.on("chat:send", (payload, callback) => {
    const room = cleanRoom(payload?.room);
    const body = typeof payload?.body === "string" ? payload.body.trim() : "";
    if (!room || !body || body.length > 2000) return typeof callback === "function" && callback({ error: "Message must be 1–2000 characters." });
    if (!socket.rooms.has(room)) return typeof callback === "function" && callback({ error: "Join the room before posting." });
    const result = db.prepare("INSERT INTO messages (room, username, body) VALUES (?, ?, ?)").run(room, socket.user.username, body);
    const message = { id: Number(result.lastInsertRowid), room, username: socket.user.username, body, createdAt: new Date().toISOString() };
    io.to(room).emit("chat:message", message);
    if (typeof callback === "function") callback({ ok: true });
  });
  // WebRTC signaling only: media flows peer-to-peer. Production needs TURN for reliability.
  socket.on("call:offer", payload => relayCall(socket, payload, "call:offer"));
  socket.on("call:answer", payload => relayCall(socket, payload, "call:answer"));
  socket.on("call:ice", payload => relayCall(socket, payload, "call:ice"));
  socket.on("call:hangup", payload => relayCall(socket, payload, "call:hangup"));
  socket.on("disconnect", () => {
    for (const room of socket.rooms) if (room !== socket.id) socket.to(room).emit("presence", { username: socket.user.username, state: "left" });
  });
});
function relayCall(socket, payload, eventName) {
  const room = cleanRoom(payload?.room);
  if (!room || !socket.rooms.has(room)) return;
  // Broadcast only to peers in the room; client must show consent before accepting media.
  socket.to(room).emit(eventName, { ...payload, room, from: socket.user.username });
}
server.listen(PORT, () => console.log(`Bryar 1.0 listening on http://localhost:${PORT}`));
