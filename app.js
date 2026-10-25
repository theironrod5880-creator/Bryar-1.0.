'use strict';

(function () {
  const roomDescriptions = {
    general: 'A friendly space for everyday conversation and questions.',
    introductions: 'Say hello and share only what you feel comfortable sharing.',
    'ideas-and-projects': 'Bring a question, a sketch, or an idea you want to explore.'
  };
  let currentRoom = 'general';
  const messagesEl = document.getElementById('messages');
  const form = document.getElementById('messageForm');
  const input = document.getElementById('messageInput');
  const toastEl = document.getElementById('toast');
  let toastTimer;

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  function roomTitle(room) {
    return '# ' + room;
  }

  function switchRoom(room) {
    currentRoom = room;
    document.querySelectorAll('.room').forEach(button => {
      const active = button.dataset.room === room;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    document.getElementById('roomTitle').textContent = roomTitle(room);
    document.getElementById('composerRoom').textContent = roomTitle(room);
    document.getElementById('aboutTitle').textContent = room;
    document.getElementById('aboutDescription').textContent = roomDescriptions[room] || 'A community room.';
    renderRoomMessages();
  }

  function createMessage(role, name, content, tagText, avatarText) {
    const article = document.createElement('article');
    article.className = 'message';
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar ' + (role === 'user' ? 'user-avatar' : 'bryar-avatar');
    avatar.textContent = avatarText;
    const body = document.createElement('div');
    body.className = 'message-body';
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    const strong = document.createElement('strong');
    strong.textContent = name;
    meta.appendChild(strong);
    if (tagText) {
      const tag = document.createElement('span');
      tag.className = role === 'user' ? 'system-tag' : 'ai-tag';
      tag.textContent = tagText;
      meta.appendChild(tag);
    }
    const time = document.createElement('time');
    time.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    meta.appendChild(time);
    const p = document.createElement('p');
    p.textContent = content;
    body.append(meta, p);
    article.append(avatar, body);
    return article;
  }

  function renderRoomMessages() {
    messagesEl.replaceChildren();
    const divider = document.createElement('div');
    divider.className = 'day-divider';
    const label = document.createElement('span');
    label.textContent = roomTitle(currentRoom).toUpperCase();
    divider.appendChild(label);
    messagesEl.appendChild(divider);
    let stored = { ok: false, messages: [] };
    if (window.BROD_CHAT_STORE) {
      const all = BROD_CHAT_STORE.list();
      const match = all.find(thread => thread.title === 'room:' + currentRoom);
      if (match) stored = BROD_CHAT_STORE.getMessages(match.id);
    }
    if (stored.ok && stored.messages.length) {
      stored.messages.forEach(message => {
        messagesEl.appendChild(createMessage(message.role === 'user' ? 'user' : 'ai', message.role === 'user' ? 'You' : 'Bryar Companion', message.content, message.role === 'user' ? 'MEMBER' : 'AI DEMO', message.role === 'user' ? 'Y' : 'B'));
      });
    } else {
      const intro = currentRoom === 'general'
        ? 'Welcome in. This is the local Bryar chat preview. Messages you send are saved on this device only.'
        : (roomDescriptions[currentRoom] || 'Welcome to this room.') + ' This is a local preview; no other members are connected yet.';
      messagesEl.appendChild(createMessage('ai', 'Bryar Companion', intro, 'AI COMPANION DEMO', 'B'));
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function getOrCreateRoomThread() {
    if (!window.BROD_CHAT_STORE) return null;
    const title = 'room:' + currentRoom;
    const found = BROD_CHAT_STORE.list().find(thread => thread.title === title);
    if (found) return found.id;
    const created = BROD_CHAT_STORE.create({ title });
    return created.ok ? created.thread.id : null;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const content = input.value.trim();
    if (!content) return;
    const threadId = getOrCreateRoomThread();
    if (!threadId) {
      toast('Could not save this message. Check local storage or remove an old chat.');
      return;
    }
    const result = BROD_CHAT_STORE.appendMessage(threadId, 'user', content);
    if (!result.ok) {
      toast('Message could not be saved: ' + result.error);
      return;
    }
    input.value = '';
    input.style.height = 'auto';
    renderRoomMessages();
    toast('Saved on this device. No other people are connected yet.');
  });

  input.addEventListener('input', function () {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  });
  input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  document.getElementById('roomList').addEventListener('click', function (event) {
    const button = event.target.closest('[data-room]');
    if (button) switchRoom(button.dataset.room);
  });
  document.getElementById('newRoomBtn').addEventListener('click', function () {
    const raw = window.prompt('Name your room (letters, numbers, and hyphens):');
    if (!raw) return;
    const room = raw.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
    if (!room) { toast('Please enter a valid room name.'); return; }
    if (document.querySelector('[data-room="' + room + '"]')) { switchRoom(room); return; }
    const button = document.createElement('button');
    button.className = 'room';
    button.dataset.room = room;
    button.type = 'button';
    const hash = document.createElement('span');
    hash.textContent = '#';
    button.append(hash, document.createTextNode(' ' + room));
    document.getElementById('roomList').appendChild(button);
    roomDescriptions[room] = 'A room created in this local preview.';
    switchRoom(room);
    toast('Room created for this browser preview.');
  });
  document.getElementById('audioBtn').addEventListener('click', () => toast('Audio calling is planned; it is not connected in this starter.'));
  document.getElementById('videoBtn').addEventListener('click', () => toast('Video calling is planned; it is not connected in this starter.'));
  document.getElementById('profileBtn').addEventListener('click', () => toast('Profile accounts are not configured in this starter.'));

  switchRoom('general');
})();
