/* ============================================================
   iOS Panel — Firestore Key Delivery v2.0 (No Backend)
   ============================================================
   Flow:
   1. User order দেয়
   2. Balance check (client-side + Firestore transaction)
   3. Firestore transaction:
      a. iosKeyPool/{variant} থেকে একটা unused key নাও
      b. key কে "used" mark করো (usedBy, usedAt)
      c. users/{uid} থেকে credit deduct করো
      d. iosOrders/{orderId} তে order save করো
   4. Key screen এ দেখাও + copy button

   Firestore Structure:
   iosKeyPool/
     1d/
       keys/           ← subcollection
         {docId}: { key: "ABC-123", used: false }
         {docId}: { key: "DEF-456", used: false }
     7d/
       keys/
         ...
     31d/
       keys/
         ...
   iosOrders/
     {orderId}: { userId, variant, key, amountUsd, createdAt, ... }
   ============================================================ */

import { db, auth } from './firebase-core.js';
import {
  collection, doc, getDoc, getDocs, updateDoc, addDoc, runTransaction,
  query, where, limit, orderBy, serverTimestamp, increment
} from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js';

const IOS_VARIANTS = {
  '1d':    { label: '1 Day',                       price: 5  },
  '7d':    { label: '7 Days',                       price: 14 },
  '31d':   { label: '31 Days',                      price: 25 },
  'setup': { label: 'Full Set-up (First Time Only)', price: 40 },
};

// In-flight lock — double click protect
const _processing = new Set();

// ── HTML escape ──────────────────────────────────────────────
function esc(v) {
  return String(v || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Error box ────────────────────────────────────────────────
function showIosError(html) {
  const el = document.getElementById('iosOrderError');
  if (!el) return;
  el.innerHTML = html;
  el.style.display = 'block';
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => { el.style.display = 'none'; }, 6000);
}

function hideIosError() {
  const el = document.getElementById('iosOrderError');
  if (el) el.style.display = 'none';
}

// ── CSS ──────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('iosPanelCSS')) return;
  const s = document.createElement('style');
  s.id = 'iosPanelCSS';
  s.textContent = `
    @keyframes iosIn{from{opacity:0;transform:scale(.88) translateY(20px)}to{opacity:1;transform:none}}
    @keyframes iosRing{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.55);opacity:0}}
    @keyframes iosDraw{to{stroke-dashoffset:0}}
    @keyframes iosDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.6)}}
    @keyframes iosSpin{to{transform:rotate(360deg)}}
  `;
  document.head.appendChild(s);
}

// ════════════════════════════════════════════════════════════
//  MAIN ORDER FUNCTION
// ════════════════════════════════════════════════════════════
async function placeIosOrder(variantKey, email, btnEl) {
  const variant = IOS_VARIANTS[variantKey];
  if (!variant) { showIosError('Invalid variant.'); return; }

  // ── Auth check ───────────────────────────────────────────
  const user = auth.currentUser;
  if (!user) {
    window.rabbiAuth?.openLogin?.('apply');
    return;
  }

  // ── Email check ──────────────────────────────────────────
  if (!email || !email.includes('@')) {
    showIosError('Valid email address দাও।');
    return;
  }

  // ── Double-click protection ──────────────────────────────
  const lockKey = user.uid + '_' + variantKey;
  if (_processing.has(lockKey)) {
    showIosError('Order processing চলছে… একটু অপেক্ষা করো।');
    return;
  }
  _processing.add(lockKey);

  // ── Client-side balance pre-check ────────────────────────
  const credit = typeof window.rabbiAuth?.getCredit === 'function'
    ? window.rabbiAuth.getCredit()
    : null;
  if (credit !== null && credit < variant.price) {
    _processing.delete(lockKey);
    showIosError(
      `Balance কম ($${credit.toFixed(2)} আছে, দরকার $${variant.price})। ` +
      `<a href="add-credit.html" style="color:#00c8ff;font-weight:900;">Add Credit →</a>`
    );
    return;
  }

  // ── Button loading state ─────────────────────────────────
  injectStyles();
  const origHtml = btnEl?.innerHTML || '';
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="vertical-align:-3px;margin-right:6px;animation:iosSpin .7s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Processing…`;
  }

  hideIosError();

  try {
    let deliveredKey = null;
    let orderId = null;

    // 'setup' variant এর জন্য key নেই — manual
    if (variantKey === 'setup') {
      // শুধু balance deduct করো + order record save করো
      await runTransaction(db, async (t) => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await t.get(userRef);
        if (!userSnap.exists()) throw Object.assign(new Error('User data পাওয়া যায়নি।'), { code: 'NO_USER' });

        const currentCredit = Number(userSnap.data()?.credit || 0);
        if (currentCredit < variant.price) {
          throw Object.assign(
            new Error(`Insufficient balance ($${currentCredit.toFixed(2)} / $${variant.price})`),
            { code: 'INSUFFICIENT_BALANCE' }
          );
        }

        // Balance deduct
        t.update(userRef, { credit: currentCredit - variant.price });
      });

      // Order save (outside transaction — no key involved)
      const orderRef = await addDoc(collection(db, 'iosOrders'), {
        userId: user.uid,
        userEmail: user.email || email,
        email,
        variant: variantKey,
        variantLabel: variant.label,
        amountUsd: variant.price,
        status: 'pending_setup',
        key: null,
        createdAt: serverTimestamp(),
        serviceName: 'Free Fire iPhone Panel (iOS)',
      });
      orderId = orderRef.id;

    } else {
      // ── Key variant: Firestore transaction ───────────────
      // Step 1: unused key খোঁজো (transaction এর বাইরে — getDocs allowed)
      const keysRef = collection(db, 'iosKeyPool', variantKey, 'keys');
      const unusedQ = query(keysRef, where('used', '==', false), orderBy('addedAt'), limit(1));
      const unusedSnap = await getDocs(unusedQ);

      if (unusedSnap.empty) {
        throw Object.assign(
          new Error('এই মুহূর্তে key available নেই। Support এ contact করো।'),
          { code: 'NO_KEYS' }
        );
      }

      const keyDocRef = unusedSnap.docs[0].ref;
      const keyData = unusedSnap.docs[0].data();

      // Step 2: Transaction — key mark + balance deduct + order create
      const orderDocRef = doc(collection(db, 'iosOrders'));
      orderId = orderDocRef.id;

      await runTransaction(db, async (t) => {
        // Re-read key inside transaction (race condition protect)
        const keySnap = await t.get(keyDocRef);
        if (!keySnap.exists() || keySnap.data().used === true) {
          throw Object.assign(
            new Error('Key টা অন্য কেউ নিয়ে গেছে। আবার চেষ্টা করো।'),
            { code: 'KEY_TAKEN' }
          );
        }

        // Re-read user balance inside transaction
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await t.get(userRef);
        if (!userSnap.exists()) throw Object.assign(new Error('User data পাওয়া যায়নি।'), { code: 'NO_USER' });

        const currentCredit = Number(userSnap.data()?.credit || 0);
        if (currentCredit < variant.price) {
          throw Object.assign(
            new Error(`Insufficient balance ($${currentCredit.toFixed(2)} / $${variant.price})`),
            { code: 'INSUFFICIENT_BALANCE' }
          );
        }

        // Mark key as used
        t.update(keyDocRef, {
          used: true,
          usedBy: user.uid,
          usedByEmail: user.email || email,
          usedAt: serverTimestamp(),
          orderId,
        });

        // Deduct balance
        t.update(userRef, { credit: currentCredit - variant.price });

        // Save order
        t.set(orderDocRef, {
          userId: user.uid,
          userEmail: user.email || email,
          email,
          variant: variantKey,
          variantLabel: variant.label,
          amountUsd: variant.price,
          status: 'delivered',
          key: keyData.key,
          keyDocId: keyDocRef.id,
          createdAt: serverTimestamp(),
          deliveredAt: serverTimestamp(),
          serviceName: 'Free Fire iPhone Panel (iOS)',
        });
      });

      deliveredKey = keyData.key;
    }

    _processing.delete(lockKey);
    if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = origHtml; }

    // ── Success overlay দেখাও ───────────────────────────────
    showDeliveryOverlay({ key: deliveredKey, variant, orderId, email });

  } catch (err) {
    _processing.delete(lockKey);
    if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = origHtml; }

    console.error('[iOS Panel] Order failed:', err);

    if (err.code === 'INSUFFICIENT_BALANCE') {
      showIosError(
        err.message +
        ` <a href="add-credit.html" style="color:#00c8ff;font-weight:900;">Add Credit →</a>`
      );
    } else if (err.code === 'NO_KEYS') {
      showIosError('Key available নেই। Admin এ contact করো — Support Chat খোলো।');
    } else if (err.code === 'KEY_TAKEN') {
      // Retry একবার automatically
      showIosError('একটু সমস্যা হয়েছে। আবার চেষ্টা করো।');
    } else {
      showIosError(err.message || 'Order failed। আবার চেষ্টা করো।');
    }
  }
}

// ════════════════════════════════════════════════════════════
//  KEY DELIVERY OVERLAY
// ════════════════════════════════════════════════════════════
function showDeliveryOverlay({ key, variant, orderId, email }) {
  // Close service modal
  const svcModal = document.getElementById('serviceModal');
  if (svcModal) { svcModal.classList.remove('open'); document.body.style.overflow = ''; }

  let ov = document.getElementById('iosDeliveryOverlay');
  if (ov) ov.remove();
  ov = document.createElement('div');
  ov.id = 'iosDeliveryOverlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.85);backdrop-filter:blur(18px);padding:20px;';
  document.body.appendChild(ov);

  const hasKey = !!key;

  ov.innerHTML = `
    <div style="width:min(460px,100%);border-radius:28px;padding:36px 28px 28px;text-align:center;
      background:linear-gradient(180deg,rgba(0,191,255,.13) 0%,rgba(2,5,15,1) 100%);
      border:1px solid rgba(0,191,255,.38);
      box-shadow:0 40px 100px rgba(0,0,0,.7),0 0 70px rgba(0,191,255,.07);
      animation:iosIn .45s cubic-bezier(.2,1,.2,1) both;">

      <!-- Ring icon -->
      <div style="width:86px;height:86px;border-radius:50%;margin:0 auto 22px;position:relative;
        background:rgba(0,191,255,.12);border:2px solid rgba(0,191,255,.42);
        display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:-8px;border-radius:50%;border:2px solid rgba(0,191,255,.18);animation:iosRing 1.7s ease-out infinite;"></div>
        ${hasKey
          ? `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00bfff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"
               style="stroke-dasharray:60;stroke-dashoffset:60;animation:iosDraw .55s ease .12s forwards;">
               <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
             </svg>`
          : `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00bfff" stroke-width="2.3" stroke-linecap="round">
               <path d="M20 6 9 17l-5-5"/>
             </svg>`
        }
      </div>

      <!-- Badge -->
      <div style="display:inline-flex;align-items:center;gap:7px;padding:5px 14px;border-radius:999px;
        background:rgba(0,191,255,.10);border:1px solid rgba(0,191,255,.28);
        color:#80dfff;font-size:.7rem;font-weight:900;letter-spacing:.07em;text-transform:uppercase;margin-bottom:14px;">
        <span style="width:6px;height:6px;border-radius:50%;background:#00bfff;display:inline-block;animation:iosDot 1s ease-in-out infinite;"></span>
        ${hasKey ? '✓ Key Delivered' : 'Order Confirmed'}
      </div>

      <!-- Title -->
      <h2 style="font-family:var(--font-display,inherit);font-size:1.55rem;color:#eef6ff;margin:0 0 8px;line-height:1.2;">
        ${hasKey ? 'তোমার iOS Panel Key!' : 'Setup Order Placed!'}
      </h2>
      <p style="color:#6a8aaa;font-size:.88rem;line-height:1.72;margin:0 0 22px;">
        ${hasKey
          ? `<strong style="color:#9ee8ff;">${esc(variant.label)}</strong> এর key নিচে দেওয়া হয়েছে। এখনই copy করো।`
          : `Full Set-up order confirm। Admin <strong style="color:#9ee8ff;">${esc(email)}</strong> এ 10–15 মিনিটের মধ্যে contact করবে।`
        }
      </p>

      ${hasKey ? `
      <!-- Key box -->
      <div style="background:rgba(0,0,0,.65);border:1.5px solid rgba(0,191,255,.28);border-radius:16px;padding:18px 16px;margin-bottom:16px;">
        <div style="font-size:.68rem;color:#3a6a80;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;">
          🔑 Activation Key
        </div>
        <div id="iosKeyText" style="font-family:'Courier New',Courier,monospace;font-size:1rem;color:#00e5ff;
          word-break:break-all;line-height:1.75;user-select:all;letter-spacing:.04em;
          padding:10px;background:rgba(0,229,255,.04);border-radius:10px;">
          ${esc(key)}
        </div>
        <button id="iosCopyBtn" type="button" onclick="window._iosCopyKey()"
          style="margin-top:13px;width:100%;border:0;border-radius:11px;padding:12px;
          background:linear-gradient(135deg,#0070e0,#00bfff);color:#fff;font-weight:900;
          font-size:.9rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;
          transition:opacity .2s;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy Key
        </button>
      </div>

      <div style="padding:11px 14px;border-radius:11px;background:rgba(255,160,0,.07);border:1px solid rgba(255,160,0,.18);
        color:#ffb84d;font-size:.78rem;line-height:1.6;margin-bottom:20px;text-align:left;">
        ⚠️ এই key শুধু একবারই দেখানো হবে। এখনই copy করে safe জায়গায় রাখো। Dashboard এর My Orders এ order history দেখতে পাবে।
      </div>
      ` : `
      <div style="padding:14px 16px;border-radius:14px;background:rgba(0,191,255,.06);border:1px solid rgba(0,191,255,.15);
        color:#7ab8d0;font-size:.83rem;line-height:1.68;margin-bottom:22px;text-align:left;">
        📧 Email: <strong style="color:#9ee8ff;">${esc(email)}</strong><br>
        ⏱ সময়: সর্বোচ্চ <strong style="color:#ffa500;">10–15 মিনিট</strong>
      </div>
      `}

      <!-- Buttons -->
      <button type="button" onclick="window._iosOpenReview()"
        style="width:100%;border:none;border-radius:14px;padding:14px;margin-bottom:9px;
        background:linear-gradient(135deg,#ffa500,#ffcc44);color:#02050a;font-weight:950;
        font-size:.95rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;
        box-shadow:0 10px 30px rgba(255,165,0,.2);">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        Rate Your Experience
      </button>
      <button type="button" onclick="document.getElementById('iosDeliveryOverlay').remove()"
        style="width:100%;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px;
        background:rgba(255,255,255,.05);color:#5a7a94;font-size:.85rem;cursor:pointer;">
        Close
      </button>

      <div style="margin-top:12px;font-size:.7rem;color:#253545;">Order: ${esc(orderId || '')}</div>
    </div>
  `;

  // Store for copy + review
  window._iosCurrentKey = key;
  window._iosCurrentService = 'Free Fire iPhone Panel (iOS)';
}

// ── Copy key ─────────────────────────────────────────────────
window._iosCopyKey = async function () {
  const key = window._iosCurrentKey;
  if (!key) return;
  const btn = document.getElementById('iosCopyBtn');
  try {
    await navigator.clipboard.writeText(key);
    if (btn) {
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg> Copied!`;
      btn.style.background = 'linear-gradient(135deg,#00aa44,#00ff88)';
      setTimeout(() => {
        if (btn) {
          btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Key`;
          btn.style.background = 'linear-gradient(135deg,#0070e0,#00bfff)';
        }
      }, 2500);
    }
  } catch {
    // Fallback — select text
    const el = document.getElementById('iosKeyText');
    if (el) {
      const r = document.createRange(); r.selectNodeContents(el);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    }
  }
};

// ── Review open ───────────────────────────────────────────────
window._iosOpenReview = function () {
  const ov = document.getElementById('iosDeliveryOverlay');
  if (ov) ov.remove();
  if (typeof window.openReviewModal === 'function') {
    window.openReviewModal(window._iosCurrentService || 'Free Fire iPhone Panel (iOS)');
  }
};

// ════════════════════════════════════════════════════════════
//  SERVICE MODAL INTEGRATION
//  service-modal.js এর handleBuyWithCredit() এ ffIos detect
//  করে এই function call হয়
// ════════════════════════════════════════════════════════════
window.placeIosOrder = placeIosOrder;

// Variant radio value → variantKey detect helper
window._detectIosVariant = function (radioValue) {
  const v = (radioValue || '').toLowerCase();
  if (v.startsWith('1 day')  || v.includes('$5'))  return '1d';
  if (v.startsWith('7 day')  || v.includes('$14')) return '7d';
  if (v.startsWith('31 day') || v.includes('$25')) return '31d';
  if (v.includes('set-up')   || v.includes('$40')) return 'setup';
  return null;
};
