/* ============================================================
   RabbiHossainLTD — Support Chat Widget  v3.0
   - Auto-reply bot flow with quick-action buttons
   - Support ticket system with Firebase
   - Admin panel integration
   ============================================================ */

import { auth, db } from './firebase-core.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js';
import {
  collection, doc, addDoc, setDoc, getDoc, onSnapshot,
  query, orderBy, serverTimestamp, limit, updateDoc, increment, where, getDocs
} from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';

(function () {
  'use strict';

  /* ── Helpers ─────────────────────────────────────────── */
  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function fmtTime(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function genTicketId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = 'TKT-';
    for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }
  function nowStr() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /* ── State ───────────────────────────────────────────── */
  let currentUser = null;
  let isOpen = false;
  let unsubMessages = null;
  let botState = 'idle'; // idle | greeted | menu | agent_form | agent_waiting | live
  let activeTicketId = null;
  let unreadCount = 0;

  /* ── DOM refs ─────────────────────────────────────────── */
  const widget   = document.getElementById('floatChatWidget');
  const winEl    = document.getElementById('floatChatWindow');
  const closeBtn = document.getElementById('floatChatClose');
  const toggle   = document.getElementById('floatChatToggle');
  const msgsEl   = document.getElementById('floatChatMessages');
  const inputEl  = document.getElementById('floatChatInput');
  const sendBtn  = document.getElementById('floatChatSend');
  const badge    = document.getElementById('floatChatBadge');
  const iconChat = document.getElementById('floatIconChat');
  const iconClose= document.getElementById('floatIconClose');

  if (!widget || !winEl) return;

  /* ── Render helpers ───────────────────────────────────── */
  function appendMsg(role, html, isHtml) {
    const wrap = document.createElement('div');
    wrap.className = 'float-msg ' + (role === 'user' ? 'float-msg-user' : 'float-msg-admin');
    const bubble = document.createElement('div');
    bubble.className = 'float-msg-bubble';
    if (isHtml) bubble.innerHTML = html;
    else bubble.textContent = html;
    const time = document.createElement('div');
    time.className = 'float-msg-time';
    time.textContent = nowStr();
    wrap.appendChild(bubble);
    wrap.appendChild(time);
    msgsEl.appendChild(wrap);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return wrap;
  }

  function appendTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'float-msg float-msg-admin float-msg-typing-wrap';
    wrap.innerHTML = `<div class="float-msg-bubble float-typing-bubble">
      <span class="float-typing-dot"></span>
      <span class="float-typing-dot"></span>
      <span class="float-typing-dot"></span>
    </div>`;
    msgsEl.appendChild(wrap);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return wrap;
  }

  function removeTyping() {
    const el = msgsEl.querySelector('.float-msg-typing-wrap');
    if (el) el.remove();
  }

  function botSay(html, isHtml, delay) {
    return new Promise(resolve => {
      const typing = appendTyping();
      setTimeout(() => {
        removeTyping();
        appendMsg('admin', html, isHtml);
        resolve();
      }, delay || 800);
    });
  }

  function showQuickButtons(buttons) {
    // Remove any existing quick buttons
    removeQuickButtons();
    const row = document.createElement('div');
    row.className = 'float-quick-btns';
    row.id = 'floatQuickBtns';
    buttons.forEach(btn => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'float-quick-btn';
      b.textContent = btn.label;
      b.addEventListener('click', () => {
        removeQuickButtons();
        btn.action();
      });
      row.appendChild(b);
    });
    msgsEl.appendChild(row);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function removeQuickButtons() {
    const el = document.getElementById('floatQuickBtns');
    if (el) el.remove();
  }

  function showAgentForm() {
    removeQuickButtons();
    const ticketId = genTicketId();
    const wrap = document.createElement('div');
    wrap.className = 'float-agent-form-wrap';
    wrap.id = 'floatAgentForm';
    const displayName = currentUser?.displayName || '';
    const email = currentUser?.email || '';
    wrap.innerHTML = `
      <div class="float-form-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        এজেন্টের সাথে কথা বলুন
      </div>
      <div class="float-form-ticket-id">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        Ticket ID: <strong>${ticketId}</strong>
      </div>
      <input class="float-form-input" type="text" id="agentFormName" placeholder="আপনার নাম *" value="${escHtml(displayName)}" required />
      <input class="float-form-input" type="email" id="agentFormEmail" placeholder="Gmail / Email *" value="${escHtml(email)}" required />
      <input class="float-form-input" type="tel" id="agentFormPhone" placeholder="ফোন নম্বর *" required />
      <textarea class="float-form-input float-form-textarea" id="agentFormProblem" placeholder="আপনার সমস্যা সংক্ষেপে লিখুন *" rows="3"></textarea>
      <div class="float-form-ticket-note">Support ID: <code>${ticketId}</code> — এটি সংরক্ষণ করুন</div>
      <button type="button" class="float-form-submit" id="agentFormSubmit">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg>
        Submit করুন
      </button>
    `;
    msgsEl.appendChild(wrap);
    msgsEl.scrollTop = msgsEl.scrollHeight;

    document.getElementById('agentFormSubmit').addEventListener('click', () => submitAgentForm(ticketId));
  }

  async function submitAgentForm(ticketId) {
    const name    = document.getElementById('agentFormName')?.value.trim();
    const email   = document.getElementById('agentFormEmail')?.value.trim();
    const phone   = document.getElementById('agentFormPhone')?.value.trim();
    const problem = document.getElementById('agentFormProblem')?.value.trim();

    if (!name || !email || !phone || !problem) {
      const submitBtn = document.getElementById('agentFormSubmit');
      if (submitBtn) {
        submitBtn.textContent = 'সব ঘর পূরণ করুন!';
        submitBtn.style.background = 'rgba(255,80,80,.25)';
        submitBtn.style.borderColor = 'rgba(255,80,80,.5)';
        setTimeout(() => {
          submitBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg> Submit করুন`;
          submitBtn.style.background = '';
          submitBtn.style.borderColor = '';
        }, 2000);
      }
      return;
    }

    const submitBtn = document.getElementById('agentFormSubmit');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'সাবমিট হচ্ছে...'; }

    try {
      const userId = currentUser?.uid || 'guest_' + Date.now();
      const userEmail = currentUser?.email || email;

      // Save ticket to Firestore
      await setDoc(doc(db, 'supportTickets', ticketId), {
        ticketId,
        userId,
        userName: name,
        userEmail: email,
        userPhone: phone,
        problemDescription: problem,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        unreadAdmin: 1,
      });

      // Create/update support room
      await setDoc(doc(db, 'supportRooms', userId), {
        userId,
        userEmail,
        displayName: name,
        userPhone: phone,
        ticketId,
        lastMessage: problem,
        lastAt: serverTimestamp(),
        unreadAdmin: increment(1),
        status: 'open',
      }, { merge: true });

      // Add first message to supportChats
      await addDoc(collection(db, 'supportChats', userId, 'messages'), {
        text: `[Ticket: ${ticketId}] ${problem}`,
        role: 'user',
        userId,
        userEmail,
        userName: name,
        userPhone: phone,
        ticketId,
        createdAt: serverTimestamp(),
      });

      // Remove form
      const form = document.getElementById('floatAgentForm');
      if (form) form.remove();

      activeTicketId = ticketId;
      botState = 'agent_waiting';

      // Show confirmation message
      await botSay('কিছুক্ষণ অপেক্ষা করুন আপনার সমস্যাটি একজন এজেন্ট এর কাছে ট্রান্সফার করা হচ্ছে', false, 600);

      // Show waiting animation
      showWaitingAnimation();

      // Disable input while waiting for agent
      if (inputEl) { inputEl.disabled = true; inputEl.placeholder = 'এজেন্টের জন্য অপেক্ষা করুন...'; }
      if (sendBtn) sendBtn.disabled = true;

      // Subscribe to messages from admin
      subscribeToAdminReplies(userId);

    } catch (e) {
      console.error('Support ticket error:', e);
      const submitBtn2 = document.getElementById('agentFormSubmit');
      if (submitBtn2) { submitBtn2.disabled = false; submitBtn2.textContent = 'আবার চেষ্টা করুন'; }
    }
  }

  function showWaitingAnimation() {
    const wrap = document.createElement('div');
    wrap.className = 'float-msg float-msg-admin float-waiting-wrap';
    wrap.id = 'floatWaitingAnim';
    wrap.innerHTML = `<div class="float-msg-bubble float-waiting-bubble">
      <div class="float-waiting-inner">
        <div class="float-wait-ring">
          <svg width="22" height="22" viewBox="0 0 50 50" fill="none">
            <circle cx="25" cy="25" r="20" stroke="rgba(0,200,255,.2)" stroke-width="4"/>
            <circle cx="25" cy="25" r="20" stroke="#00c8ff" stroke-width="4"
              stroke-dasharray="60 66" stroke-linecap="round" class="float-wait-arc"/>
          </svg>
        </div>
        <span class="float-waiting-text">এজেন্ট সংযুক্ত হচ্ছেন</span>
      </div>
      <div class="float-wait-dots">
        <span class="float-typing-dot"></span>
        <span class="float-typing-dot"></span>
        <span class="float-typing-dot"></span>
      </div>
    </div>`;
    msgsEl.appendChild(wrap);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function subscribeToAdminReplies(userId) {
    if (unsubMessages) unsubMessages();
    const q = query(
      collection(db, 'supportChats', userId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    let initialLoad = true;
    let knownIds = new Set();

    unsubMessages = onSnapshot(q, (snap) => {
      if (initialLoad) {
        // Load all existing messages
        snap.docs.forEach(d => knownIds.add(d.id));
        initialLoad = false;
        return;
      }
      snap.docChanges().forEach(change => {
        if (change.type === 'added' && !knownIds.has(change.doc.id)) {
          knownIds.add(change.doc.id);
          const d = change.doc.data();
          if (d.role === 'admin' && d.adminEmail !== 'auto-reply') {
            // Real agent replied — remove waiting animation
            const waitAnim = document.getElementById('floatWaitingAnim');
            if (waitAnim) waitAnim.remove();
            botState = 'live';
            // Enable input
            if (inputEl) { inputEl.disabled = false; inputEl.placeholder = 'বার্তা লিখুন...'; }
            if (sendBtn) sendBtn.disabled = false;
            appendMsg('admin', d.text, false);
            if (!isOpen) {
              unreadCount++;
              badge.textContent = unreadCount;
              badge.style.display = 'flex';
            }
          } else if (d.role === 'admin' && d.adminEmail === 'auto-reply') {
            // ignore auto-reply in this flow
          } else if (d.role === 'system' && d.type === 'solved') {
            // Ticket marked as solved
            handleTicketSolved();
          }
        }
      });
    });
  }

  function handleTicketSolved() {
    const waitAnim = document.getElementById('floatWaitingAnim');
    if (waitAnim) waitAnim.remove();
    removeQuickButtons();
    appendMsg('admin',
      'আপনার সমস্যাটি সমাধান হয়েছে। ধন্যবাদ RabbiHossainLTD ব্যবহার করার জন্য।', false);

    botState = 'idle';
    activeTicketId = null;
    if (inputEl) { inputEl.disabled = true; inputEl.placeholder = 'সেশন শেষ হয়েছে'; }
    if (sendBtn) sendBtn.disabled = true;

    // Show restart button
    setTimeout(() => {
      showQuickButtons([{
        label: 'নতুন কথোপকথন শুরু করুন',
        action: () => {
          msgsEl.innerHTML = '';
          botState = 'idle';
          if (inputEl) { inputEl.disabled = false; inputEl.placeholder = 'বার্তা লিখুন...'; }
          if (sendBtn) sendBtn.disabled = false;
          if (unsubMessages) { unsubMessages(); unsubMessages = null; }
          startBotFlow();
        }
      }]);
    }, 500);
  }

  /* ── Bot flow ─────────────────────────────────────────── */
  async function startBotFlow() {
    if (botState !== 'idle') return;
    botState = 'greeted';

    await botSay('আসসালামুয়ালাইকুম, Rabbi Hossain LTD তে আপনাকে স্বাগতম আপনাকে কিভাবে সহযোগিতা করতে পারি', false, 900);

    await new Promise(r => setTimeout(r, 400));
    await botSay('আপনার সমস্যা নির্বাচন করুন নিচের অপশন গুলা থেকে', false, 700);

    botState = 'menu';
    showMainMenu();
  }

  function showMainMenu() {
    showQuickButtons([
      {
        label: 'পেমেন্ট কিভাবে করব?',
        action: () => handleMenuChoice('payment')
      },
      {
        label: 'কিভাবে অ্যাপ কিনব?',
        action: () => handleMenuChoice('app')
      },
      {
        label: 'গেমে টপআপ কিভাবে করব?',
        action: () => handleMenuChoice('topup')
      },
      {
        label: 'এজেন্ট এর সাথে কথা বলবো',
        action: () => handleMenuChoice('agent')
      },
    ]);
  }

  async function handleMenuChoice(choice) {
    const labels = {
      payment: 'পেমেন্ট কিভাবে করব?',
      app: 'কিভাবে অ্যাপ কিনব?',
      topup: 'গেমে টপআপ কিভাবে করব?',
      agent: 'এজেন্ট এর সাথে কথা বলবো',
    };
    appendMsg('user', labels[choice], false);

    if (choice === 'payment') {
      botState = 'answering';
      await botSay(
        `<strong>পেমেন্ট পদ্ধতি:</strong><br><br>` +
        `আমরা নিচের মাধ্যমে পেমেন্ট গ্রহণ করি:<br><br>` +
        `<div class="float-answer-list">` +
        `<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> <strong>bKash</strong> — 01731-410341</div>` +
        `<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> <strong>Nagad</strong> — 01731-410341</div>` +
        `<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> <strong>Rocket</strong> — 01731-410341</div>` +
        `<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> <strong>Card / Wallet</strong> — Dashboard থেকে Add Credit</div>` +
        `</div><br>` +
        `পেমেন্ট করার পর Transaction ID সহ আমাদের WhatsApp-এ জানান।`,
        true, 900
      );
      await new Promise(r => setTimeout(r, 400));
      showBackToMenuBtn();

    } else if (choice === 'app') {
      botState = 'answering';
      await botSay(
        `<strong>অ্যাপ কেনার পদ্ধতি:</strong><br><br>` +
        `<div class="float-answer-list">` +
        `<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> <strong>ধাপ ১:</strong> Services পেজে যান</div>` +
        `<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> <strong>ধাপ ২:</strong> আপনার পছন্দের অ্যাপ বেছে নিন</div>` +
        `<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> <strong>ধাপ ৩:</strong> "Get Now" বাটনে ক্লিক করুন</div>` +
        `<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> <strong>ধাপ ৪:</strong> পরিমাণ ও তথ্য পূরণ করুন</div>` +
        `<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> <strong>ধাপ ৫:</strong> পেমেন্ট করুন ও অপেক্ষা করুন</div>` +
        `</div><br>` +
        `সাধারণত <strong style="color:#00ff88;">৫–৩০ মিনিটের</strong> মধ্যে ডেলিভারি দেওয়া হয়।`,
        true, 900
      );
      await new Promise(r => setTimeout(r, 400));
      showBackToMenuBtn();

    } else if (choice === 'topup') {
      botState = 'answering';
      await botSay(
        `<strong>গেম টপআপ পদ্ধতি (Free Fire):</strong><br><br>` +
        `<div class="float-answer-list">` +
        `<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> <strong>Diamond Top-up:</strong> আপনার Player ID দিন</div>` +
        `<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> <strong>iOS Panel:</strong> Apple ID প্রয়োজন হবে</div>` +
        `<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> <strong>Android Panel:</strong> Game এ লগইন থাকতে হবে</div>` +
        `<div class="float-answer-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> <strong>PC Panel:</strong> PC তে গেম থাকতে হবে</div>` +
        `</div><br>` +
        `Services পেজ থেকে আপনার ডিভাইস অনুযায়ী প্যাকেজ বেছে নিন। ` +
        `Topup সাধারণত <strong style="color:#00ff88;">১৫ মিনিটের</strong> মধ্যে সম্পন্ন হয়।`,
        true, 900
      );
      await new Promise(r => setTimeout(r, 400));
      showBackToMenuBtn();

    } else if (choice === 'agent') {
      botState = 'agent_form';
      await botSay('অনুগ্রহ করে নিচের ফর্মটি পূরণ করুন। আপনার তথ্য দিয়ে submit করলে একজন এজেন্ট শীঘ্রই যোগাযোগ করবেন।', false, 700);
      await new Promise(r => setTimeout(r, 300));
      showAgentForm();
    }
  }

  function showBackToMenuBtn() {
    showQuickButtons([
      {
        label: 'আরেকটি সমস্যা',
        action: () => {
          botState = 'menu';
          appendMsg('user', 'আরেকটি সমস্যা আছে', false);
          botSay('অবশ্যই! নিচের অপশন থেকে বেছে নিন।', false, 500).then(() => {
            botState = 'menu';
            showMainMenu();
          });
        }
      },
      {
        label: 'ধন্যবাদ, সাহায্য হয়েছে',
        action: () => {
          appendMsg('user', 'ধন্যবাদ', false);
          botSay('আপনাকে সাহায্য করতে পেরে আনন্দিত হলাম। আর কোনো সমস্যা হলে আমাদের সাথে যোগাযোগ করুন।', false, 700).then(() => {
            botState = 'idle';
          });
        }
      }
    ]);
  }

  /* ── Chat open/close ──────────────────────────────────── */
  function openChat() {
    isOpen = true;
    winEl.style.display = 'flex';
    iconChat.style.display = 'none';
    iconClose.style.display = '';
    unreadCount = 0;
    badge.style.display = 'none';
    badge.textContent = '';
    if (inputEl) setTimeout(() => inputEl.focus(), 60);

    // Start bot flow if first open
    if (botState === 'idle' && msgsEl.children.length === 0) {
      startBotFlow();
    }
  }

  function closeChat() {
    isOpen = false;
    winEl.style.display = 'none';
    iconChat.style.display = '';
    iconClose.style.display = 'none';
  }

  /* ── User sends message ───────────────────────────────── */
  async function sendUserMessage() {
    if (!inputEl) return;
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';

    if (!currentUser) {
      appendMsg('user', text, false);
      await botSay('বার্তা পাঠাতে প্রথমে <a href="services.html" style="color:#00c8ff;">লগইন করুন</a> অথবা WhatsApp-এ যোগাযোগ করুন।', true, 600);
      return;
    }

    // If in live agent mode, send to Firebase
    if (botState === 'live') {
      appendMsg('user', text, false);
      try {
        await addDoc(collection(db, 'supportChats', currentUser.uid, 'messages'), {
          text,
          role: 'user',
          userId: currentUser.uid,
          userEmail: currentUser.email || '',
          createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, 'supportRooms', currentUser.uid), {
          lastMessage: text,
          lastAt: serverTimestamp(),
          unreadAdmin: increment(1),
        });
      } catch (e) {
        appendMsg('admin', 'বার্তা পাঠানো যায়নি। আবার চেষ্টা করুন।', false);
      }
      return;
    }

    // Otherwise: bot responds
    appendMsg('user', text, false);
    if (botState === 'idle') {
      startBotFlow();
    } else if (botState === 'menu') {
      await botSay('অনুগ্রহ করে নিচের অপশন থেকে বেছে নিন।', false, 600);
      showMainMenu();
    } else {
      // Generic fallback
      await botSay('আপনার বার্তা পেয়েছি। নিচের অপশন থেকে সঠিক বিষয়টি বেছে নিন।', false, 700);
      botState = 'menu';
      showMainMenu();
    }
  }

  /* ── Events ──────────────────────────────────────────── */
  toggle.addEventListener('click', () => isOpen ? closeChat() : openChat());
  closeBtn.addEventListener('click', closeChat);
  if (sendBtn) sendBtn.addEventListener('click', sendUserMessage);
  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); sendUserMessage(); }
    });
  }

  /* ── Auth state ───────────────────────────────────────── */
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
  });

})();
