import { auth } from './firebase-core.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js';

(function () {
  'use strict';

  const BACKEND = 'https://rabbi-backend-vlr7.onrender.com';
  const STORE = 'rh_cs_thread';
  const widget = document.getElementById('floatChatWidget');
  const winEl = document.getElementById('floatChatWindow');
  const closeBtn = document.getElementById('floatChatClose');
  const toggle = document.getElementById('floatChatToggle');
  const msgsEl = document.getElementById('floatChatMessages');
  const inputEl = document.getElementById('floatChatInput');
  const sendBtn = document.getElementById('floatChatSend');
  const badge = document.getElementById('floatChatBadge');
  const iconChat = document.getElementById('floatIconChat');
  const iconClose = document.getElementById('floatIconClose');
  if (!widget || !winEl || !msgsEl) return;

  let currentUser = null;
  let isOpen = false;
  let unreadCount = 0;
  let geminiBusy = false;
  let pendingImage = null;
  let thread = loadThread();

  function loadThread() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!raw || raw.solved || !Array.isArray(raw.messages)) {
        return { messages: [], history: [], started: false };
      }
      return {
        messages: raw.messages.slice(-80),
        history: Array.isArray(raw.history) ? raw.history.slice(-16) : [],
        started: !!raw.started
      };
    } catch (e) {
      return { messages: [], history: [], started: false };
    }
  }

  function saveThread() {
    try {
      const slim = thread.messages.map(m => {
        const row = { role: m.role, text: m.text || '', time: m.time || '' };
        if (m.image && String(m.image).length < 180000) row.image = m.image;
        return row;
      });
      localStorage.setItem(STORE, JSON.stringify({
        messages: slim,
        history: thread.history.slice(-16),
        started: thread.started,
        solved: false,
        ts: Date.now()
      }));
    } catch (e) {
      try {
        const noImg = thread.messages.map(m => ({ role: m.role, text: m.text || '', time: m.time || '' }));
        localStorage.setItem(STORE, JSON.stringify({
          messages: noImg,
          history: thread.history.slice(-16),
          started: thread.started,
          solved: false,
          ts: Date.now()
        }));
      } catch (e2) {}
    }
  }

  function clearThread() {
    thread = { messages: [], history: [], started: false };
    try { localStorage.removeItem(STORE); } catch (e) {}
  }

  function customerName() {
    try {
      const d = window.rabbiAuth && window.rabbiAuth.getUserData && window.rabbiAuth.getUserData();
      if (d && d.name) return String(d.name).trim();
    } catch (e) {}
    if (currentUser && currentUser.displayName) return String(currentUser.displayName).trim();
    try {
      const c = JSON.parse(localStorage.getItem('rh_user_cache') || '{}');
      if (c.displayName) return String(c.displayName).trim();
    } catch (e) {}
    return '';
  }

  function firstName() {
    const n = customerName();
    return n ? n.split(/\s+/)[0] : '';
  }

  function nowStr() {
    return new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
  }

  function injectChrome() {
    if (!document.getElementById('rh-cs-extra-css')) {
      const css = document.createElement('style');
      css.id = 'rh-cs-extra-css';
      css.textContent =
        '#floatChatHeaderActions{display:flex;align-items:center;gap:6px;flex-shrink:0}' +
        '#floatChatSolved{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#e8e8e4;border-radius:999px;padding:6px 10px;font-size:.72rem;font-weight:800;cursor:pointer;font-family:inherit}' +
        '#floatChatSolved:hover{background:#fff;color:#111;border-color:#fff}' +
        'html[data-theme="light"] #floatChatSolved{background:#fff;color:#111;border:1px solid #111}' +
        '#floatChatAttach{width:38px;height:38px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#eee;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
        '#floatChatAttach:hover{background:rgba(255,255,255,.14)}' +
        '#floatChatAttach.has-file{border-color:#fff;background:#fff;color:#111}' +
        '.float-msg-img{display:block;max-width:220px;max-height:180px;border-radius:12px;margin-bottom:6px;object-fit:cover}' +
        '#floatAttachPreview{display:none;padding:0 12px 8px;align-items:center;gap:8px}' +
        '#floatAttachPreview.on{display:flex}' +
        '#floatAttachPreview img{width:44px;height:44px;object-fit:cover;border-radius:8px}' +
        '#floatAttachPreview button{border:none;background:none;color:#aaa;cursor:pointer;font-size:.8rem}';
      document.head.appendChild(css);
    }
    const header = document.getElementById('floatChatHeader');
    if (header && !document.getElementById('floatChatSolved')) {
      let actions = document.getElementById('floatChatHeaderActions');
      if (!actions) {
        actions = document.createElement('div');
        actions.id = 'floatChatHeaderActions';
        if (closeBtn) actions.appendChild(closeBtn);
        header.appendChild(actions);
      }
      const solved = document.createElement('button');
      solved.type = 'button';
      solved.id = 'floatChatSolved';
      solved.textContent = 'সমাধান হয়েছে';
      actions.insertBefore(solved, closeBtn || null);
      solved.addEventListener('click', markSolved);
    }
    const area = document.getElementById('floatChatInputArea');
    if (area && !document.getElementById('floatChatAttach')) {
      const attach = document.createElement('button');
      attach.type = 'button';
      attach.id = 'floatChatAttach';
      attach.setAttribute('aria-label', 'ছবি সংযুক্ত করুন');
      attach.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
      area.insertBefore(attach, inputEl || area.firstChild);
      const file = document.createElement('input');
      file.type = 'file';
      file.accept = 'image/*';
      file.hidden = true;
      file.id = 'floatChatFile';
      area.appendChild(file);
      attach.addEventListener('click', () => file.click());
      file.addEventListener('change', () => {
        const f = file.files && file.files[0];
        file.value = '';
        if (f) pickImage(f);
      });
    }
    if (!document.getElementById('floatAttachPreview') && area) {
      const prev = document.createElement('div');
      prev.id = 'floatAttachPreview';
      prev.innerHTML = '<img alt=""><span></span><button type="button">সরান</button>';
      area.parentNode.insertBefore(prev, area);
      prev.querySelector('button').addEventListener('click', clearPendingImage);
    }
    if (inputEl) inputEl.placeholder = 'বার্তা লিখুন...';
  }

  function setPendingPreview() {
    const prev = document.getElementById('floatAttachPreview');
    const attach = document.getElementById('floatChatAttach');
    if (!prev) return;
    if (pendingImage) {
      prev.classList.add('on');
      const img = prev.querySelector('img');
      if (img) img.src = pendingImage;
      attach && attach.classList.add('has-file');
    } else {
      prev.classList.remove('on');
      attach && attach.classList.remove('has-file');
    }
  }

  function clearPendingImage() {
    pendingImage = null;
    setPendingPreview();
  }

  function pickImage(file) {
    if (!file || !String(file.type || '').startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 720;
        const scale = Math.min(max / img.width, max / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        pendingImage = canvas.toDataURL('image/jpeg', 0.7);
        setPendingPreview();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function paintMessage(m, persist) {
    const wrap = document.createElement('div');
    wrap.className = 'float-msg ' + (m.role === 'user' ? 'float-msg-user' : 'float-msg-admin');
    const b = document.createElement('div');
    b.className = 'float-msg-bubble';
    if (m.image) {
      const im = document.createElement('img');
      im.className = 'float-msg-img';
      im.src = m.image;
      im.alt = 'সংযুক্ত ছবি';
      b.appendChild(im);
    }
    if (m.text) {
      const t = document.createElement('div');
      t.textContent = m.text;
      b.appendChild(t);
    }
    const time = document.createElement('div');
    time.className = 'float-msg-time';
    time.textContent = m.time || nowStr();
    wrap.appendChild(b);
    wrap.appendChild(time);
    msgsEl.appendChild(wrap);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    if (persist) {
      thread.messages.push({ role: m.role, text: m.text || '', image: m.image || '', time: m.time || nowStr() });
      saveThread();
    }
    return wrap;
  }

  function appendTyping() {
    const w = document.createElement('div');
    w.className = 'float-msg float-msg-admin float-typing-wrap';
    w.innerHTML = `<div class="float-msg-bubble float-typing-bubble"><span class="float-typing-dot"></span><span class="float-typing-dot"></span><span class="float-typing-dot"></span></div>`;
    msgsEl.appendChild(w);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function removeTyping() {
    document.querySelector('.float-typing-wrap')?.remove();
  }

  function restoreMessages() {
    msgsEl.innerHTML = '';
    thread.messages.forEach(m => paintMessage(m, false));
    if (thread.started) showShortcuts(false);
  }

  function showShortcuts(afterReply) {
    document.getElementById('floatQuickBtns')?.remove();
    const row = document.createElement('div');
    row.className = 'float-quick-btns';
    row.id = 'floatQuickBtns';
    const items = afterReply
      ? [
          { label: 'আরও সাহায্য চাই', text: 'আরও একটু সাহায্য দরকার' },
          { label: 'হোয়াটসঅ্যাপ', href: 'https://wa.me/8801731410341' }
        ]
      : [
          { label: 'অর্ডার কোথায়?', text: 'আমার অর্ডারের আপডেট জানতে চাই' },
          { label: 'ক্রেডিট যোগ করব কীভাবে?', text: 'ওয়ালেটে ক্রেডিট কীভাবে যোগ করব?' },
          { label: 'সার্ভিস নিতে চাই', text: 'একটা সার্ভিস নিতে চাই, কীভাবে শুরু করব?' },
          { label: 'হোয়াটসঅ্যাপে কথা বলব', href: 'https://wa.me/8801731410341' }
        ];
    items.forEach(item => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'float-quick-btn';
      b.textContent = item.label;
      b.addEventListener('click', () => {
        document.getElementById('floatQuickBtns')?.remove();
        if (item.href) {
          window.open(item.href, '_blank', 'noopener');
          return;
        }
        sendText(item.text);
      });
      row.appendChild(b);
    });
    msgsEl.appendChild(row);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  async function greetIfNeeded() {
    if (thread.started) return;
    const name = firstName();
    const hello = name
      ? `আসসালামু আলাইকুম ${name}, স্বাগতম। আমি RH Support। কীভাবে সাহায্য করতে পারি?`
      : 'আসসালামু আলাইকুম, স্বাগতম। আমি RH Support। কীভাবে সাহায্য করতে পারি?';
    paintMessage({ role: 'admin', text: hello, time: nowStr() }, true);
    thread.started = true;
    thread.history.push({ role: 'model', text: hello });
    saveThread();
    showShortcuts(false);
  }

  async function askGemini(text, image) {
    if (geminiBusy) return;
    geminiBusy = true;
    if (inputEl) inputEl.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    appendTyping();
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (currentUser && typeof currentUser.getIdToken === 'function') {
        try { headers.Authorization = 'Bearer ' + await currentUser.getIdToken(); } catch (e) {}
      }
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 45000);
      const res = await fetch(BACKEND + '/api/support/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: text || '',
          name: customerName(),
          image: image || '',
          history: thread.history.slice(-8)
        }),
        signal: ctrl.signal
      });
      clearTimeout(t);
      let data = {};
      try { data = await res.json(); } catch (e) {}
      removeTyping();
      const reply = (data && data.ok && data.reply)
        ? String(data.reply)
        : (data && data.message) || 'এখন উত্তর দিতে পারছি না। একটু পরে চেষ্টা করুন, অথবা হোয়াটসঅ্যাপে লিখুন।';
      paintMessage({ role: 'admin', text: reply, time: nowStr() }, true);
      thread.history.push({ role: 'user', text: text || 'ছবি পাঠিয়েছি' });
      thread.history.push({ role: 'model', text: reply });
      saveThread();
      showShortcuts(true);
    } catch (err) {
      removeTyping();
      paintMessage({ role: 'admin', text: 'সংযোগ পাওয়া যায়নি। একটু পরে চেষ্টা করুন।', time: nowStr() }, true);
      showShortcuts(true);
    } finally {
      geminiBusy = false;
      if (inputEl) inputEl.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  function sendText(text) {
    const msg = String(text || '').trim();
    const image = pendingImage;
    if (!msg && !image) return;
    clearPendingImage();
    paintMessage({ role: 'user', text: msg, image: image || '', time: nowStr() }, true);
    thread.started = true;
    saveThread();
    askGemini(msg, image);
  }

  function markSolved() {
    paintMessage({
      role: 'admin',
      text: firstName()
        ? `${firstName()}, আপনার সমস্যা সমাধান হয়েছে ধরে নিচ্ছি। ধন্যবাদ। আবার খুললে নতুন চ্যাট শুরু হবে।`
        : 'আপনার সমস্যা সমাধান হয়েছে ধরে নিচ্ছি। ধন্যবাদ। আবার খুললে নতুন চ্যাট শুরু হবে।',
      time: nowStr()
    }, false);
    clearThread();
    pendingImage = null;
    setPendingPreview();
    setTimeout(() => {
      closeChat();
      msgsEl.innerHTML = '';
    }, 900);
  }

  function openChat() {
    isOpen = true;
    winEl.style.display = 'flex';
    if (iconChat) iconChat.style.display = 'none';
    if (iconClose) iconClose.style.display = '';
    unreadCount = 0;
    if (badge) { badge.style.display = 'none'; badge.textContent = ''; }
    if (!msgsEl.children.length && thread.messages.length) restoreMessages();
    if (!thread.started) greetIfNeeded();
    else msgsEl.scrollTop = msgsEl.scrollHeight;
    if (inputEl) setTimeout(() => inputEl.focus(), 60);
  }

  function closeChat() {
    isOpen = false;
    winEl.style.display = 'none';
    if (iconChat) iconChat.style.display = '';
    if (iconClose) iconClose.style.display = 'none';
    saveThread();
  }

  injectChrome();
  if (thread.messages.length) restoreMessages();

  function sendFromBox() {
    const v = inputEl ? inputEl.value : '';
    if (inputEl) inputEl.value = '';
    sendText(v);
  }
  toggle.addEventListener('click', () => isOpen ? closeChat() : openChat());
  closeBtn.addEventListener('click', closeChat);
  sendBtn?.addEventListener('click', sendFromBox);
  inputEl?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendFromBox();
    }
  });
  onAuthStateChanged(auth, user => { currentUser = user; });
})();
