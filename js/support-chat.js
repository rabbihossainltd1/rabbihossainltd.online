import { auth } from './firebase-core.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js';

(function () {
  'use strict';

  const PREVIEW_HOST = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    || location.hostname.includes('e2b.app')
    || location.hostname.includes('e2b.dev');
  // Production uses Render. Local/Arena preview uses the same-origin test route
  // so the updated backend can be verified before either repository is pushed.
  const BACKEND = PREVIEW_HOST ? '' : 'https://rabbi-backend-vlr7.onrender.com';
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
        return emptyThread();
      }
      return {
        messages: raw.messages.slice(-80),
        history: Array.isArray(raw.history) ? raw.history.slice(-16) : [],
        started: !!raw.started,
        topic: raw.topic || '',
        homeShown: !!raw.homeShown
      };
    } catch (e) {
      return emptyThread();
    }
  }

  function emptyThread() {
    return { messages: [], history: [], started: false, topic: '', homeShown: false };
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
        topic: thread.topic || '',
        homeShown: !!thread.homeShown,
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
          topic: thread.topic || '',
          homeShown: !!thread.homeShown,
          solved: false,
          ts: Date.now()
        }));
      } catch (e2) {}
    }
  }

  function clearThread() {
    thread = emptyThread();
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
        '#floatChatAttach{width:38px;height:38px;border-radius:10px;border:1px solid rgba(255,255,255,.34)!important;background:#161616!important;color:#f5f5f3!important;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
        '#floatChatAttach svg{stroke:currentColor!important;color:#f5f5f3!important}' +
        '#floatChatAttach:hover{background:#2a2a2a!important}' +
        '#floatChatAttach.has-file{border-color:#fff!important;background:#fff!important;color:#111!important}' +
        '#floatChatAttach.has-file svg{color:#111!important;stroke:currentColor!important}' +
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
        '.float-prod-actions{display:flex;gap:8px;margin-top:9px}' +
        '.float-prod-cart,.float-prod-buy{flex:1;text-align:center;text-decoration:none;border-radius:10px;padding:8px 8px;font-size:.74rem;font-weight:800;cursor:pointer;font-family:inherit}' +
        '.float-prod-cart{background:#161616;color:#f5f5f3;border:1px solid rgba(255,255,255,.34)}' +
        '.float-prod-buy{background:#161616;color:#f5f5f3;border:1px solid rgba(255,255,255,.34)}' +
        'html[data-theme="light"] .float-prod-cart,html[data-theme="light"] .float-prod-buy{background:#fff;color:#111;border:1px solid #111}' +
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
        'html[data-theme="light"] #floatChatInputArea{border-top:1px solid rgba(0,0,0,.1)}' +
        '#floatQuickSlot{display:none;flex-direction:column;gap:7px;padding:4px 12px 8px;flex-shrink:0}' +
        '#floatQuickSlot.on{display:flex}' +
        '#floatQuickSlot .float-quick-btns{margin:0;align-self:stretch}' +
        '#floatChatWidget{bottom:12px!important;right:16px!important}' +
        'body.has-bottom-nav #floatChatWidget{bottom:72px!important;right:12px!important}' +
        '#floatChatWindow{max-height:calc(100dvh - var(--nav-h, 70px) - 88px)!important}' +
        'body.has-bottom-nav #floatChatWindow{max-height:calc(100dvh - var(--nav-h, 70px) - 152px)!important}' +
        '#floatChatMessages{max-height:none!important;min-height:120px}';
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
    ensureQuickSlot();
  }

  function ensureQuickSlot() {
    let slot = document.getElementById('floatQuickSlot');
    if (slot) return slot;
    slot = document.createElement('div');
    slot.id = 'floatQuickSlot';
    const area = document.getElementById('floatChatInputArea');
    if (area && area.parentNode) area.parentNode.insertBefore(slot, area);
    else if (winEl) winEl.appendChild(slot);
    return slot;
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
  }

  const PRODUCTS = [
    { id: 'chatgpt', keys: ['chatgpt', 'জিপিটি', 'gpt'], title: 'ChatGPT', href: '/checkout/?service=chatgpt', price: 'Go $10 · Plus $20 · Pro $200', perk: 'GPT-4o, ছবি তৈরি, দ্রুত উত্তর', slug: 'chatgpt', serviceName: 'Premium App & Subscription', serviceId: 'proapp', proapp: 'chatgpt', plans: [{ k: 'go', label: 'Go · 1 Month', usd: 10 }, { k: 'plus', label: 'Plus · 1 Month', usd: 20 }, { k: 'pro', label: 'Pro · 1 Month', usd: 200 }] },
    { id: 'gemini', keys: ['gemini', 'জেমিনি'], title: 'Gemini AI', href: '/checkout/?service=gemini', price: 'AI Pro $19.99 · Ultra $249.99', perk: 'Google-এর শক্তিশালী AI + 1TB স্টোরেজ', slug: 'gemini', serviceName: 'Premium App & Subscription', serviceId: 'proapp', proapp: 'gemini', plans: [{ k: 'pro', label: 'AI Pro · 1 Month', usd: 19.99 }, { k: 'ultra', label: 'AI Ultra · 1 Month', usd: 249.99 }] },
    { id: 'netflix', keys: ['netflix', 'নেটফ্লিক্স'], title: 'Netflix', href: '/checkout/?service=netflix', price: '$2.99 থেকে $9.99', perk: 'অ্যাড ছাড়া মুভি ও সিরিজ', slug: 'netflix', serviceName: 'Premium App & Subscription', serviceId: 'proapp', proapp: 'netflix', plans: [{ k: 'mobile', label: 'Mobile · 1 Month', usd: 2.99 }, { k: 'basic', label: 'Basic · 1 Month', usd: 4.99 }, { k: 'standard', label: 'Standard · 1 Month', usd: 6.99 }, { k: 'premium', label: 'Premium · 1 Month', usd: 9.99 }] },
    { id: 'canva', keys: ['canva', 'ক্যানভা'], title: 'Canva Pro', href: '/checkout/?service=canva', price: 'Pro $12.99/মাস', perk: 'প্রিমিয়াম টেমপ্লেট, ব্যাকগ্রাউন্ড রিমুভার', slug: 'canva', serviceName: 'Premium App & Subscription', serviceId: 'proapp', proapp: 'canva', plans: [{ k: 'pro', label: 'Pro · 1 Month', usd: 12.99 }] },
    { id: 'youtube', keys: ['youtube', 'ইউটিউব'], title: 'YouTube Premium', href: '/checkout/?service=youtube', price: '$2.49 থেকে $6.99', perk: 'অ্যাড ফ্রি + ব্যাকগ্রাউন্ড প্লে', slug: 'youtube', serviceName: 'Premium App & Subscription', serviceId: 'proapp', proapp: 'youtube', plans: [{ k: 'individual', label: 'Premium Individual · 1 Month', usd: 3.99 }, { k: 'family', label: 'Premium Family · 1 Month', usd: 6.99 }, { k: 'student', label: 'Premium Student · 1 Month', usd: 2.49 }] },
    { id: 'capcut', keys: ['capcut', 'ক্যাপকাট'], title: 'CapCut Pro', href: '/checkout/?service=capcut', price: '$9.99/মাস', perk: 'ওয়াটারমার্ক ছাড়া ৪কে এডিট', slug: 'capcut', serviceName: 'Premium App & Subscription', serviceId: 'proapp', proapp: 'capcut', plans: [{ k: 'pro', label: 'Pro · 1 Month', usd: 9.99 }] },
    { id: 'grok', keys: ['grok', 'গ্রক'], title: 'Grok AI', href: '/checkout/?service=grok', price: '$5 থেকে $20/মাস', perk: 'রিয়েল-টাইম এক্স/টুইটার ডেটা', slug: 'grok', serviceName: 'Premium App & Subscription', serviceId: 'proapp', proapp: 'grok', plans: [{ k: 'basic', label: 'Grok Basic · 1 Month', usd: 5 }, { k: 'plus', label: 'Grok Plus · 1 Month', usd: 15 }, { k: 'premium', label: 'Grok Premium · 1 Month', usd: 20 }] },
    { id: 'meta-verified', keys: ['meta', 'মেটা', 'verified', 'ভেরিফাই', 'blue tick', 'ব্লু টিক'], title: 'Meta Verified', href: '/checkout/?service=meta-verified', price: '$12 / ৳1,500', perk: 'ফেসবুক নীল টিক, বিশ্বাসযোগ্যতা', slug: 'meta-verified', serviceName: 'Facebook Meta Verified', serviceId: 'meta', amountUsd: 12 },
    { id: 'visa-mastercard', keys: ['visa', 'mastercard', 'ভিসা', 'মাস্টারকার্ড', 'কার্ড'], title: 'Visa / Mastercard', href: '/checkout/?service=visa-mastercard', price: 'ভার্চুয়াল $12 থেকে', perk: 'আন্তর্জাতিক পেমেন্ট ও সাবস্ক্রিপশন', slug: 'visa-mastercard', serviceName: 'Visa / Mastercard', serviceId: 'card' },
    { id: 'free-fire-topup', keys: ['free fire', 'ফ্রি ফায়ার', 'diamond', 'ডায়মন্ড', 'topup', 'টপআপ', 'টপ-আপ', 'uid'], title: 'Free Fire Diamond', href: '/checkout/?service=free-fire-topup', price: 'লাইভ প্যাকেজ · UID টপ-আপ', perk: 'লগইন ছাড়াই সরাসরি UID-এ ডায়মন্ড', slug: 'free-fire-topup', serviceName: 'Free Fire Diamond Top-up', serviceId: 'ff' },
    { id: 'ff-ios', keys: ['ios panel', 'iphone panel', 'আইফোন প্যানেল'], title: 'Free Fire iOS Panel', href: '/checkout/?service=ff-ios', price: '$5 থেকে $40', perk: 'জেলব্রেক ছাড়া আইফোন প্যানেল', slug: 'ff-ios', serviceName: 'Free Fire iPhone Panel (iOS)', serviceId: 'ffIos' },
    { id: 'ff-drip', keys: ['drip', 'ড্রিপ'], title: 'FF Drip Panel', href: '/checkout/?service=ff-drip', price: '$0.90 থেকে $10', perk: 'রুটেড অ্যান্ড্রয়েড প্যানেল', slug: 'ff-drip', serviceName: 'Free Fire Android Panel Drip Client (Root)', serviceId: 'ffDrip' },
    { id: 'web-development', keys: ['website', 'ওয়েবসাইট', 'web development'], title: 'Website Development', href: '/checkout/?service=web-development', price: 'শুরু $50', perk: 'বিজনেস সাইট ও ল্যান্ডিং পেজ', slug: 'web-development', serviceName: 'Website Development', serviceId: 'webDev', amountUsd: 50 },
    { id: 'truecaller', keys: ['truecaller', 'ট্রু কলার', 'ট্রুকলার'], title: 'Truecaller', href: '/checkout/?service=truecaller', price: 'Premium $1.99 থেকে · Gold $4.99', perk: 'কলার আইডি ও স্প্যাম ব্লক', slug: 'truecaller', serviceName: 'Premium App & Subscription', serviceId: 'proapp', proapp: 'truecaller' },
    { id: 'imo', keys: ['imo', 'আইএমও'], title: 'imo Premium', href: '/checkout/?service=imo', price: '$0.29 থেকে $7.49', perk: 'প্রিমিয়াম ব্যাজ ও স্টোরি ভিউ', slug: 'imo', serviceName: 'Premium App & Subscription', serviceId: 'proapp', proapp: 'imo' },
    { id: 'vpn', keys: ['vpn', 'ভিপিএন'], title: 'Premium VPN', href: '/checkout/?service=vpn', price: '$4.99 থেকে $29.99/বছর', perk: 'আইপি হাইড, ব্লক সাইট খোলা', slug: 'vpn', serviceName: 'Premium App & Subscription', serviceId: 'proapp', proapp: 'vpn' },
    { id: 'antivirus', keys: ['antivirus', 'অ্যান্টিভাইরাস'], title: 'Antivirus', href: '/checkout/?service=antivirus', price: '$4.99 থেকে $29.99/বছর', perk: 'ভাইরাস ও ম্যালওয়্যার সুরক্ষা', slug: 'antivirus', serviceName: 'Premium App & Subscription', serviceId: 'proapp', proapp: 'antivirus' },
    { id: 'adsremove', keys: ['ads remove', 'adblock', 'অ্যাড রিমুভ', 'adsremove'], title: 'Remove Ads', href: '/checkout/?service=adsremove', price: 'Lifetime $5.99', perk: 'একবার পে, চিরকাল অ্যাড বন্ধ', slug: 'adsremove', serviceName: 'Premium App & Subscription', serviceId: 'proapp', proapp: 'adsremove', amountUsd: 5.99 },
    { id: 'premiere', keys: ['premiere', 'প্রিমিয়ার'], title: 'Adobe Premiere Pro', href: '/checkout/?service=premiere', price: '$19.99/মাস থেকে', perk: 'প্রো ভিডিও এডিটিং', slug: 'premiere', serviceName: 'Premium App & Subscription', serviceId: 'proapp', proapp: 'premiere' },
    { id: 'photoshop', keys: ['photoshop', 'ফটোশপ'], title: 'Adobe Photoshop', href: '/checkout/?service=photoshop', price: '$18.99/মাস থেকে', perk: 'ফটো এডিট ও ডিজাইন', slug: 'photoshop', serviceName: 'Premium App & Subscription', serviceId: 'proapp', proapp: 'photoshop' },
    { id: 'illustrator', keys: ['illustrator', 'ইলাস্ট্রেটর'], title: 'Adobe Illustrator', href: '/checkout/?service=illustrator', price: '$19.99/মাস থেকে', perk: 'লোগো ও ভেক্টর ডিজাইন', slug: 'illustrator', serviceName: 'Premium App & Subscription', serviceId: 'proapp', proapp: 'illustrator' },
    { id: 'windows', keys: ['windows', 'উইন্ডোজ'], title: 'Windows License', href: '/checkout/?service=windows', price: '$11.99 থেকে $29.99', perk: 'লাইফটাইম অরিজিনাল কী', slug: 'windows', serviceName: 'Premium App & Subscription', serviceId: 'proapp', proapp: 'windows' },
    { id: 'excel', keys: ['excel', 'office', 'এক্সেল', 'অফিস'], title: 'Microsoft Excel / Office', href: '/checkout/?service=excel', price: '$14.99 থেকে $49.99', perk: 'Excel, Word, PowerPoint', slug: 'excel', serviceName: 'Premium App & Subscription', serviceId: 'proapp', proapp: 'excel' },
    { id: 'ff-ff4x', keys: ['ff4x', 'ff 4x'], title: 'Free Fire FF4X Panel', href: '/checkout/?service=ff-ff4x', price: '$5 / $10 / $30', perk: 'অ্যান্ড্রয়েড প্যানেল', slug: 'ff-ff4x', serviceName: 'Free Fire Android Panel (FF4X)', serviceId: 'ffFf4x' },
    { id: 'ff-pc', keys: ['pc panel', 'পিসি প্যানেল'], title: 'Free Fire PC Panel', href: '/checkout/?service=ff-pc', price: '$0.50 থেকে $15', perk: 'ইমুলেটর প্যানেল', slug: 'ff-pc', serviceName: 'Free Fire PC Panel', serviceId: 'ffPc' },
    { id: 'br-mods', keys: ['br mods', 'brmods', 'বিআর মড'], title: 'BR Mods', href: '/checkout/?service=br-mods', price: '$0.90 থেকে $9', perk: 'রুট ছাড়া অ্যান্ড্রয়েড', slug: 'br-mods', serviceName: 'BR Mods', serviceId: 'ffBrMods' },
    { id: 'ethical-hacking', keys: ['hacking', 'security audit', 'হ্যাকিং'], title: 'Ethical Hacking', href: '/checkout/?service=ethical-hacking', price: '$30', perk: 'সিকিউরিটি অডিট', slug: 'ethical-hacking', serviceName: 'Ethical Hacking / Security Audit', serviceId: 'security', amountUsd: 30 },
    { id: 'android-development', keys: ['android app', 'অ্যান্ড্রয়েড অ্যাপ'], title: 'Android App Development', href: '/checkout/?service=android-development', price: 'শুরু $40', perk: 'কাস্টম অ্যান্ড্রয়েড অ্যাপ', slug: 'android-development', serviceName: 'Android App Development', serviceId: 'android', amountUsd: 40 },
    { id: 'digital-branding', keys: ['branding', 'লোগো', 'ব্র্যান্ডিং'], title: 'Digital Branding', href: '/checkout/?service=digital-branding', price: '$15', perk: 'লোগো ও ব্র্যান্ড আইডেন্টিটি', slug: 'digital-branding', serviceName: 'Digital Branding', serviceId: '', amountUsd: 15 },
    { id: 'premium-services', keys: ['premium digital', 'প্রিমিয়াম সার্ভিস'], title: 'Premium Digital Services', href: '/checkout/?service=premium-services', price: '$10', perk: 'কাস্টম ডিজিটাল কাজ', slug: 'premium-services', serviceName: 'Premium Digital Services', serviceId: '', amountUsd: 10 }
  ];

  function isCartIntent(text) {
    return /কার্ট|cart|যোগ কর/i.test(String(text || ''));
  }

  function addProductToCart(p) {
    if (!p || !p.slug) return null;
    const draft = {
      slug: p.slug,
      title: p.title,
      image: '/images/service-cards/' + p.slug + '.png',
      serviceName: p.serviceName || p.title,
      serviceId: p.serviceId || '',
      proapp: p.proapp || ''
    };
    try {
      if (typeof window.rhAddToCartDraft === 'function') {
        window.rhAddToCartDraft(draft);
        return { ok: true, title: p.title };
      }
      if (window.RhCart && typeof window.RhCart.add === 'function') {
        window.RhCart.add({
          slug: p.slug,
          title: p.title,
          image: draft.image,
          serviceName: draft.serviceName,
          serviceId: draft.serviceId,
          proapp: draft.proapp,
          needsPlan: true,
          amountUsd: Number(p.amountUsd) || 0,
          details: {}
        });
        return { ok: true, title: p.title };
      }
    } catch (e) {}
    return null;
  }

  function localReply(text) {
    const hits = matchProducts(text);
    const name = firstName();
    const hi = name ? name + ', ' : '';
    const t = String(text || '').toLowerCase();
    if (/ডেলিভারি|delivery|কতক্ষণ|কত খনে|কতক্ষনে/.test(t) && hits.length) {
      return hi + deliveryLine(hits[0]);
    }
    if (/ক্রেডিট|credit|wallet|ওয়ালেট|বিকাশ|নগদ|রকেট|টাকা যোগ|add credit/.test(t)) {
      return hi + 'ওয়ালেটে ক্রেডিট যোগ করতে https://rabbihossainltd.online/add-credit/ খুলুন। ডলার অ্যামাউন্ট (কমপক্ষে $1) লিখে Continue to Payment চাপুন। SPV অটো পেমেন্টে বিকাশ/নগদ/রকেট দিয়ে পে করলে ক্রেডিট কয়েক সেকেন্ডে যোগ হয়। ম্যানুয়াল TxID লাগে না। রেট সাধারণত $1 = ৳125।';
    }
    if (/অর্ডার|order status|স্ট্যাটাস|ট্র্যাক/.test(t)) {
      return hi + 'অর্ডার স্ট্যাটাস আমি এখানে দেখতে পারি না, অনুমানও করি না। প্রোফাইলের অর্ডার লিস্ট দেখুন, অথবা হোয়াটসঅ্যাপে ইমেইল/অর্ডার আইডি দিয়ে লিখুন: https://wa.me/8801731410341';
    }
    if (hits.length) {
      const bits = hits.map(p => p.title + ': ' + p.price + ' — https://rabbihossainltd.online' + p.href);
      return hi + bits.join('\n') + '\nকার্ট: https://rabbihossainltd.online/cart/';
    }
    if (/সার্ভিস|কীভাবে শুরু|কিভাবে শুরু|কিনব|অর্ডার কর/.test(t)) {
      return hi + 'লগইন করে সার্ভিস বেছে নিন, প্ল্যান সিলেক্ট করুন, তারপর ওয়ালেট বা ইনস্ট্যান্ট পে দিয়ে পে করুন। সব সার্ভিস: https://rabbihossainltd.online/services/';
    }
    if (/হোয়াটস|whatsapp|যোগাযোগ|কন্টাক্ট/.test(t)) {
      return hi + 'হোয়াটসঅ্যাপ: https://wa.me/8801731410341 — ইমেইল: support@rabbihossainltd.online';
    }
    return '';
  }

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
      a.innerHTML = '<b>' + p.title + '</b><small>' + p.price + '</small><small>' + p.perk + '</small>';
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

  function productById(id) {
    return PRODUCTS.find(p => p.id === id) || null;
  }

  function detectTopic(text) {
    const t = String(text || '').toLowerCase();
    const hits = matchProducts(t);
    if (hits.length) return hits[0].id;
    if (/ক্রেডিট|credit|wallet|ওয়ালেট|বিকাশ|নগদ|রকেট|add credit/.test(t)) return 'credit';
    if (/অর্ডার কোথায়|order status|স্ট্যাটাস|ট্র্যাক/.test(t)) return 'order';
    return '';
  }

  function deliveryLine(p) {
    if (!p) return 'পেমেন্ট কনফার্ম হলে সাধারণত কয়েক মিনিট থেকে কয়েক ঘণ্টার মধ্যে ডেলিভারি হয়।';
    if (p.serviceId === 'ff') return p.title + ' UID চেক করে পে করলে সাধারণত কয়েক মিনিটের মধ্যে অ্যাকাউন্টে যায়।';
    if (p.serviceId === 'card') return 'ভার্চুয়াল কার্ড সাধারণত দ্রুত; ফিজিক্যাল কার্ডে শিপিং সময় লাগে।';
    if (p.serviceId === 'meta') return 'মেটা ভেরিফাইডে NID/পাসপোর্ট লাগতে পারে — প্রসেস কয়েক ঘণ্টা থেকে কয়েক দিন।';
    if (p.serviceId === 'webDev' || p.serviceId === 'android' || p.serviceId === 'security') {
      return 'কাস্টম কাজ, সময় প্রজেক্ট অনুযায়ী। অর্ডারের পর আপডেট দেওয়া হয়।';
    }
    if (/^ff/i.test(String(p.serviceId || '')) || /panel/i.test(p.title)) {
      return p.title + ' কী/সেটআপ সাধারণত ইমেইলে দ্রুত যায়।';
    }
    return p.title + ' সাধারণত পেমেন্টের পর ইমেইলে কয়েক মিনিট থেকে কয়েক ঘণ্টার মধ্যে অ্যাক্টিভ হয়।';
  }

  function removeShortcuts() {
    document.querySelectorAll('.float-quick-btns').forEach(el => el.remove());
    const slot = document.getElementById('floatQuickSlot');
    if (slot) {
      slot.innerHTML = '';
      slot.classList.remove('on');
    }
  }

  function paintShortcutRow(items) {
    removeShortcuts();
    if (!items || !items.length) return;
    const slot = ensureQuickSlot();
    const row = document.createElement('div');
    row.className = 'float-quick-btns';
    row.id = 'floatQuickBtns';
    items = items.filter(item => {
      const label = String(item && item.label || '');
      const href = String(item && item.href || '');
      if (/হোয়াটস|whatsapp/i.test(label) || /wa\.me/i.test(href)) return false;
      if (/এখনই অর্ডার|এক ক্লিকে অর্ডার/i.test(label)) return false;
      return true;
    });
    if (!items.length) return;
    items.forEach(item => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'float-quick-btn';
      b.textContent = item.label;
      b.addEventListener('click', () => {
        if (item.action === 'cart' && item.product) {
          const r = addProductToCart(item.product);
          if (r && r.ok) {
            paintMessage({
              role: 'admin',
              text: r.title + ' কার্টে যোগ হয়েছে। কার্ট খুলে প্ল্যান বেছে নিয়ে পে করুন: https://rabbihossainltd.online/cart/',
              time: nowStr()
            }, true);
            showContextShortcuts(item.product.id);
          } else {
            sendText(item.product.title + ' কার্টে যোগ করুন');
          }
          return;
        }
        if (item.href) {
          if (item.href.indexOf('http') === 0) window.open(item.href, '_blank', 'noopener');
          else window.location.href = item.href;
          return;
        }
        if (item.text) sendText(item.text);
      });
      row.appendChild(b);
    });
    slot.appendChild(row);
    slot.classList.add('on');
  }

  function homeShortcuts() {
    return [
      { label: 'অর্ডার কোথায়?', text: 'আমার অর্ডারের আপডেট জানতে চাই' },
      { label: 'ক্রেডিট যোগ করব কীভাবে?', text: 'ওয়ালেটে ক্রেডিট কীভাবে যোগ করব? অটো পেমেন্ট কীভাবে কাজ করে?' },
      { label: 'সার্ভিস নিতে চাই', text: 'একটা সার্ভিস নিতে চাই, কীভাবে শুরু করব?' }
    ];
  }

  function contextItems(topic) {
    const p = productById(topic);
    if (p) {
      return [
        { label: p.title + ' কার্টে যোগ করুন', action: 'cart', product: p },
        { label: 'কতক্ষণে ডেলিভারি?', text: p.title + ' অর্ডার করলে কতক্ষণে ডেলিভারি হবে?' }
      ];
    }
    if (topic === 'credit') {
      return [
        { label: 'ক্রেডিট যোগ করুন', href: '/add-credit/' },
        { label: 'রেট কত?', text: 'ওয়ালেট ক্রেডিটের রেট কত? অটো পেমেন্ট কীভাবে কাজ করে?' }
      ];
    }
    return [];
  }

  function showHomeShortcuts() {
    if (thread.homeShown) return;
    thread.homeShown = true;
    saveThread();
    paintShortcutRow(homeShortcuts());
  }

  function showContextShortcuts(topic) {
    thread.topic = topic || thread.topic || '';
    saveThread();
    paintShortcutRow(contextItems(thread.topic));
  }

  function refreshShortcutsAfter(userText) {
    const fresh = detectTopic(userText);
    const topic = fresh || thread.topic || '';
    if (topic) showContextShortcuts(topic);
    else removeShortcuts();
  }

  async function greetIfNeeded() {
    if (thread.started) return;
    const name = firstName();
    const hello = name
      ? `আসসালামু আলাইকুম ${name}, স্বাগতম। আমি RH Support। কীভাবে সাহায্য করতে পারি?`
      : 'আসসালামু আলাইকুম, স্বাগতম। আমি RH Support। কীভাবে সাহায্য করতে পারি?';
    paintMessage({ role: 'admin', text: hello, time: nowStr() }, true);
    thread.started = true;
    saveThread();
    showHomeShortcuts();
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
      const t = setTimeout(() => ctrl.abort(), 18000);
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
      let reply = (data && data.ok && data.reply) ? String(data.reply) : '';
      if (!reply) reply = localReply(text) || (data && data.message) || 'এখন উত্তর দিতে পারছি না। একটু পরে চেষ্টা করুন, অথবা হোয়াটসঅ্যাপে লিখুন।';
      paintMessage({ role: 'admin', text: reply, time: nowStr() }, true);
      thread.history.push({ role: 'user', text: text || 'ছবি পাঠিয়েছি' });
      thread.history.push({ role: 'model', text: reply });
      saveThread();
      refreshShortcutsAfter(text);
    } catch (err) {
      removeTyping();
      const fallback = localReply(text) || 'সংযোগ পাওয়া যায়নি। একটু পরে চেষ্টা করুন, অথবা হোয়াটসঅ্যাপে লিখুন।';
      paintMessage({ role: 'admin', text: fallback, time: nowStr() }, true);
      refreshShortcutsAfter(text);
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
    removeShortcuts();
    clearPendingImage();
    paintMessage({ role: 'user', text: msg, image: image || '', time: nowStr() }, true);
    thread.started = true;
    saveThread();
    try {
      if (msg && isCartIntent(msg)) {
        const hits = matchProducts(msg);
        if (hits.length) {
          const added = [];
          hits.forEach(p => {
            const r = addProductToCart(p);
            if (r && r.ok) added.push(r.title);
          });
          if (added.length) {
            paintMessage({
              role: 'admin',
              text: added.join(', ') + ' কার্টে যোগ হয়েছে। কার্ট খুলে প্ল্যান বেছে নিয়ে পে করুন: https://rabbihossainltd.online/cart/',
              time: nowStr()
            }, true);
            renderProductCards(hits, true);
          }
        }
      }
    } catch (e) {}
    // Every message, including greetings, goes to Gemini so the reply follows
    // the user's actual wording and conversation history.
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
    if (!msgsEl.querySelector('.float-msg') && thread.messages.length) restoreMessages();
    removeShortcuts();
    if (!thread.started) greetIfNeeded();
    else if (thread.topic) showContextShortcuts(thread.topic);
    msgsEl.scrollTop = msgsEl.scrollHeight;
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
