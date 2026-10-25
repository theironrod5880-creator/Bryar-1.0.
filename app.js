(() => {
  const $ = id => document.getElementById(id);
  const authPanel = $("authPanel"), appPanel = $("appPanel");
  const roomNames = ["general", "introductions", "ideas-and-projects"];
  let currentRoom = "general", socket = null, config = {}, localStream = null, peer = null, pendingOffer = null;
  const rtcConfig = () => ({ iceServers: [{ urls: config.stunUrl || "stun:stun.l.google.com:19302" }] });
  async function api(url, options = {}) {
    const response = await fetch(url, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  }
  function status(id, text) { $(id).textContent = text; }
  function showLoggedIn(user) {
    authPanel.classList.add("hidden"); appPanel.classList.remove("hidden"); $("logoutBtn").classList.remove("hidden");
    status("connectionState", `Signed in as ${user.username}`);
    connectSocket(); renderRooms(); joinRoom(currentRoom);
  }
  async function checkSession() {
    try { config = await api("/api/config"); const result = await api("/api/me"); config = { ...config, user: result.user }; setupAds(); if (result.user) showLoggedIn(result.user); }
    catch (e) { status("authStatus", e.message); }
  }
  $("loginBtn").onclick = async () => {
    try { const r = await api("/api/login", { method: "POST", body: JSON.stringify({ username: $("username").value.trim(), password: $("password").value }) }); showLoggedIn(r.user); }
    catch (e) { status("authStatus", e.message); }
  };
  $("registerBtn").onclick = async () => {
    try { const r = await api("/api/register", { method: "POST", body: JSON.stringify({ username: $("username").value.trim(), password: $("password").value }) }); showLoggedIn(r.user); }
    catch (e) { status("authStatus", e.message); }
  };
  $("logoutBtn").onclick = async () => { await api("/api/logout", { method: "POST" }); if (socket) socket.disconnect(); location.reload(); };
  function connectSocket() {
    if (socket) return;
    socket = io();
    socket.on("connect", () => status("connectionState", "Live · connected"));
    socket.on("disconnect", () => status("connectionState", "Reconnecting…"));
    socket.on("connect_error", e => status("connectionState", e.message));
    socket.on("room:history", messages => { $("messages").replaceChildren(); messages.forEach(renderMessage); });
    socket.on("chat:message", renderMessage);
    socket.on("presence", p => addSystem(`${p.username} ${p.state} the room.`));
    socket.on("call:offer", async data => {
      pendingOffer = data;
      $("callPanel").classList.remove("hidden");
      status("callStatus", `${data.from} is calling. Accept to enable your camera/microphone.`);
      $("acceptBtn").classList.remove("hidden");
    });
    socket.on("call:answer", async data => { if (peer && data.answer) await peer.setRemoteDescription(data.answer); });
    socket.on("call:ice", async data => { if (peer && data.candidate) { try { await peer.addIceCandidate(data.candidate); } catch (_) {} } });
    socket.on("call:hangup", () => cleanupCall("The other participant ended the call."));
  }
  function renderRooms() {
    const tabs = $("roomTabs"); tabs.replaceChildren();
    roomNames.forEach(name => {
      const b = document.createElement("button"); b.className = "room-tab" + (name === currentRoom ? " active" : ""); b.textContent = "# " + name;
      b.onclick = () => joinRoom(name); tabs.appendChild(b);
    });
  }
  function joinRoom(name) {
    currentRoom = name; $("currentRoomTitle").textContent = "# " + name; $("postingRoom").textContent = "#" + name;
    renderRooms(); $("messages").replaceChildren();
    if (socket?.connected) socket.emit("room:join", name, result => { if (result?.error) addSystem(result.error); });
  }
  $("newRoomBtn").onclick = () => {
    const value = prompt("Room name (letters, numbers, hyphens):");
    if (!value) return;
    const name = value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
    if (name.length < 2) return alert("Use at least two letters or numbers.");
    if (!roomNames.includes(name)) roomNames.push(name);
    joinRoom(name);
  };
  function renderMessage(m) {
    if (m.room !== currentRoom) return;
    const wrap = document.createElement("article"); wrap.className = "message";
    const avatar = document.createElement("div"); avatar.className = "avatar"; avatar.textContent = (m.username || "?").slice(0,1).toUpperCase();
    const content = document.createElement("div"); content.className = "message-content";
    const meta = document.createElement("div"); meta.className = "message-meta";
    const user = document.createElement("strong"); user.textContent = m.username || "Member";
    const time = document.createElement("time"); time.textContent = m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "now";
    const body = document.createElement("p"); body.textContent = m.body;
    meta.append(user, time); content.append(meta, body); wrap.append(avatar, content); $("messages").append(wrap); $("messages").scrollTop = $("messages").scrollHeight;
  }
  function addSystem(text) { const p = document.createElement("p"); p.className = "system-note"; p.textContent = text; $("messages").append(p); }
  $("messageForm").onsubmit = e => {
    e.preventDefault(); const body = $("messageInput").value.trim(); if (!body || !socket) return;
    socket.emit("chat:send", { room: currentRoom, body }, result => { if (result?.error) addSystem(result.error); });
    $("messageInput").value = "";
  };
  $("messageInput").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("messageForm").requestSubmit(); } });
  $("askAiBtn").onclick = async () => {
    const message = $("messageInput").value.trim() || prompt("What would you like to ask Bryar Companion?");
    if (!message) return;
    status("aiState", "Bryar is thinking…"); $("askAiBtn").disabled = true;
    try {
      const result = await api("/api/ai", { method: "POST", body: JSON.stringify({ room: currentRoom, message }) });
      socket.emit("chat:send", { room: currentRoom, body: "✦ Bryar Companion: " + result.reply });
      status("aiState", "AI reply posted to this room.");
    } catch (e) { status("aiState", e.message); }
    finally { $("askAiBtn").disabled = false; }
  };
  async function startCall(video) {
    try {
      if (!socket?.connected) throw new Error("Connect to chat before starting a call.");
      $("callPanel").classList.remove("hidden");
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      $("localVideo").srcObject = localStream;
      peer = new RTCPeerConnection(rtcConfig());
      localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
      peer.ontrack = e => { $("remoteVideo").srcObject = e.streams[0]; };
      peer.onicecandidate = e => { if (e.candidate) socket.emit("call:ice", { room: currentRoom, candidate: e.candidate }); };
      status("callStatus", "Calling room members… They must accept before media is shared.");
      const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
      socket.emit("call:offer", { room: currentRoom, offer, video });
    } catch (e) { cleanupCall(e.message); }
  }
  $("voiceBtn").onclick = () => startCall(false);
  $("videoBtn").onclick = () => startCall(true);
  $("acceptBtn").onclick = async () => {
    if (!pendingOffer) return;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: Boolean(pendingOffer.video) });
      $("localVideo").srcObject = localStream; peer = new RTCPeerConnection(rtcConfig());
      localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
      peer.ontrack = e => { $("remoteVideo").srcObject = e.streams[0]; };
      peer.onicecandidate = e => { if (e.candidate) socket.emit("call:ice", { room: currentRoom, candidate: e.candidate }); };
      await peer.setRemoteDescription(pendingOffer.offer);
      const answer = await peer.createAnswer(); await peer.setLocalDescription(answer);
      socket.emit("call:answer", { room: currentRoom, answer }); pendingOffer = null; $("acceptBtn").classList.add("hidden");
      status("callStatus", "Call connected if the peer connection succeeds.");
    } catch (e) { cleanupCall(e.message); }
  };
  $("hangupBtn").onclick = () => { socket?.emit("call:hangup", { room: currentRoom }); cleanupCall("Call ended."); };
  function cleanupCall(message) {
    if (peer) peer.close(); peer = null;
    if (localStream) localStream.getTracks().forEach(t => t.stop()); localStream = null;
    $("localVideo").srcObject = null; $("remoteVideo").srcObject = null; $("acceptBtn").classList.add("hidden");
    status("callStatus", message);
  }
  function setupAds() {
    if (!config.adsEnabled) return;
    $("adSlot").classList.remove("hidden");
    if (config.adScriptUrl) {
      const script = document.createElement("script"); script.src = config.adScriptUrl; script.async = true; script.crossOrigin = "anonymous";
      script.onerror = () => { $("adContent").textContent = "Sponsored content is unavailable."; };
      document.head.append(script);
    } else $("adContent").textContent = "Ad placement reserved. Configure a reviewed ad provider URL on the server.";
  }
  checkSession();
})();
