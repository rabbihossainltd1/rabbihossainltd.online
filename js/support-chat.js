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
        if (m.role === 'products' && Array.isArray(m.cards)) row.cards = m.cards;
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
        '#floatAttachPreview button{border:none;background:none;color:#aaa;cursor:pointer;font-size:.8rem}' +
        '.float-prod-wrap{display:flex;flex-direction:column;gap:8px;align-self:stretch;margin-top:2px}' +
        '.float-prod-card{display:block;text-decoration:none;background:#161616;border:1.5px solid rgba(255,255,255,.34);border-radius:14px;padding:11px 12px;color:#f5f5f3}' +
        '.float-prod-card b,.float-prod-card small{color:#f5f5f3}' +
        '.float-prod-card:hover{background:#fff;color:#111;border-color:#111}' +
        '.float-prod-card:hover b,.float-prod-card:hover small{color:#111}' +
        '.float-prod-card b{display:block;font-size:.86rem;margin-bottom:3px}' +
        '.float-prod-card small{display:block;font-size:.74rem;line-height:1.45;opacity:1}' +
        'html[data-theme="light"] #floatChatWindow{background:#fff;border:1px solid #111}' +
        'html[data-theme="light"] #floatChatHeader{background:#f5f5f2;border-bottom:1px solid rgba(0,0,0,.12)}' +
        'html[data-theme="light"] #floatChatTitle{color:#111}' +
        'html[data-theme="light"] #floatChatStatus,html[data-theme="light"] #floatChatClose{color:#555}' +
        'html[data-theme="light"] .float-msg-admin .float-msg-bubble{background:#f5f5f2;color:#111;border:1px solid rgba(0,0,0,.14)}' +
        'html[data-theme="light"] .float-msg-user .float-msg-bubble{background:#111;color:#fff;border:1px solid #111}' +
        'html[data-theme="light"] .float-msg-time{color:#6f6f6c}' +
        'html[data-theme="light"] .float-quick-btn{background:#fff;color:#111;border:1px solid #111}' +
        'html[data-theme="light"] .float-quick-btn:hover{background:#111;color:#fff}' +
        'html[data-theme="light"] .float-prod-card{background:#fff;color:#111;border:1.5px solid #111}' +
        'html[data-theme="light"] .float-prod-card b,html[data-theme="light"] .float-prod-card small{color:#111}' +
        'html[data-theme="light"] #floatChatInput{background:#fff;color:#111;border:1px solid rgba(0,0,0,.18)}' +
        'html[data-theme="light"] #floatChatAttach{background:#fff;color:#111;border:1px solid #111}' +
        'html[data-theme="light"] #floatChatInputArea{border-top:1px solid rgba(0,0,0,.1)}';
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
    if (m && m.role === 'products') {
      renderProductCards(m.cards || [], false);
      if (persist) {
        thread.messages.push({ role: 'products', cards: m.cards || [], time: m.time || nowStr() });
        saveThread();
      }
      return null;
    }
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

  const PRODUCTS = [
    { id: 'chatgpt', keys: ['chatgpt', 'জিপিটি', 'gpt'], title: 'ChatGPT', href: '/checkout/?service=chatgpt', price: 'Go $10 · Plus $20 · Pro $200', perk: 'GPT-4o, ছবি তৈরি, দ্রুত উত্তর' },
    { id: 'gemini', keys: ['gemini', 'জেমিনি'], title: 'Gemini AI', href: '/checkout/?service=gemini', price: 'AI Pro $19.99 · Ultra $249.99', perk: 'Google-এর শক্তিশালী AI + 1TB স্টোরেজ' },
    { id: 'netflix', keys: ['netflix', 'নেটফ্লিক্স'], title: 'Netflix', href: '/checkout/?service=netflix', price: '$2.99 থেকে $9.99', perk: 'অ্যাড ছাড়া মুভি ও সিরিজ' },
    { id: 'canva', keys: ['canva', 'ক্যানভা'], title: 'Canva Pro', href: '/checkout/?service=canva', price: 'Pro $12.99/মাস', perk: 'প্রিমিয়াম টেমপ্লেট, ব্যাকগ্রাউন্ড রিমুভার' },
    { id: 'youtube', keys: ['youtube', 'ইউটিউব'], title: 'YouTube Premium', href: '/checkout/?service=youtube', price: '$2.49 থেকে $6.99', perk: 'অ্যাড ফ্রি + ব্যাকগ্রাউন্ড প্লে' },
    { id: 'capcut', keys: ['capcut', 'ক্যাপকাট'], title: 'CapCut Pro', href: '/checkout/?service=capcut', price: '$9.99/মাস', perk: 'ওয়াটারমার্ক ছাড়া ৪কে এডিট' },
    { id: 'grok', keys: ['grok', 'গ্রক'], title: 'Grok AI', href: '/checkout/?service=grok', price: '$5 থেকে $20/মাস', perk: 'রিয়েল-টাইম এক্স/টুইটার ডেটা' },
    { id: 'meta-verified', keys: ['meta', 'মেটা', 'verified', 'ভেরিফাই', 'blue tick', 'ব্লু টিক'], title: 'Meta Verified', href: '/checkout/?service=meta-verified', price: '$12 / ৳1,500', perk: 'ফেসবুক নীল টিক, বিশ্বাসযোগ্যতা' },
    { id: 'visa-mastercard', keys: ['visa', 'mastercard', 'ভিসা', 'মাস্টারকার্ড', 'কার্ড'], title: 'Visa / Mastercard', href: '/checkout/?service=visa-mastercard', price: 'ভার্চুয়াল $12 থেকে', perk: 'আন্তর্জাতিক পেমেন্ট ও সাবস্ক্রিপশন' },
    { id: 'free-fire-topup', keys: ['free fire', 'ফ্রি ফায়ার', 'diamond', 'ডায়মন্ড', 'topup', 'টপআপ', 'টপ-আপ', 'uid'], title: 'Free Fire Diamond', href: '/checkout/?service=free-fire-topup', price: 'লাইভ প্যাকেজ · UID টপ-আপ', perk: 'লগইন ছাড়াই সরাসরি UID-এ ডায়মন্ড' },
    { id: 'ff-ios', keys: ['ios panel', 'iphone panel', 'আইফোন প্যানেল'], title: 'Free Fire iOS Panel', href: '/checkout/?service=ff-ios', price: '$5 থেকে $40', perk: 'জেলব্রেক ছাড়া আইফোন প্যানেল' },
    { id: 'ff-drip', keys: ['drip', 'ড্রিপ'], title: 'FF Drip Panel', href: '/checkout/?service=ff-drip', price: '$0.90 থেকে $10', perk: 'রুটেড অ্যান্ড্রয়েড প্যানেল' },
    { id: 'web-development', keys: ['website', 'ওয়েবসাইট', 'web development'], title: 'Website Development', href: '/checkout/?service=web-development', price: 'শুরু $50', perk: 'বিজনেস সাইট ও ল্যান্ডিং পেজ' }
  ];

  function matchProducts(text) {
    const t = String(text || '').toLowerCase();
    const hits = [];
    PRODUCTS.forEach(p => {
      if (p.keys.some(k => t.indexOf(k) !== -1)) hits.push(p);
    });
    return hits.slice(0, 3);
  }

  function renderProductCards(hits, persist) {
    if (!hits || !hits.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'float-prod-wrap';
    hits.forEach(p => {
      const a = document.createElement('a');
      a.className = 'float-prod-card';
      a.href = p.href;
      a.innerHTML = '<b>' + p.title + '</b><small>' + p.price + '</small><small>' + p.perk + '</small><small>এক ক্লিকে অর্ডার →</small>';
      wrap.appendChild(a);
    });
    msgsEl.appendChild(wrap);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    if (persist) {
      thread.messages.push({
        role: 'products',
        cards: hits.map(p => ({ title: p.title, href: p.href, price: p.price, perk: p.perk })),
        time: nowStr()
      });
      saveThread();
    }
  }

  function showProductCards(text) {
    const hits = matchProducts(text);
    renderProductCards(hits, true);
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
          { label: 'ক্রেডিট যোগ করব কীভাবে?', text: 'ওয়ালেটে ক্রেডিট কীভাবে যোগ করব? অটো পেমেন্ট কীভাবে কাজ করে?' },
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
      showProductCards((text || '') + ' ' + reply);
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
