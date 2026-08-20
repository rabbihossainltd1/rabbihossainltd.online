import { auth, db } from "./firebase-core.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  increment
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const USD_TO_BDT = 125;

const PAYMENT_NUMBERS = {
  bKash: "01731410341",
  Nagad: "01731410341",
  Rocket: "01731410341",
  Binance: "749542753",
};

const ADMIN_EMAILS = ["rabbihossainltd@gmail.com"];
const BACKEND_API_BASE = "https://rabbi-backend-production.up.railway.app";

function backendRoute(path) {
  if (!path) return "/api/health";
  if (path.startsWith("/api/index")) return path;
  if (path.startsWith("/api/")) {
    return "/api/" + encodeURIComponent(path.replace("/api/", ""));
  }
  return path;
}

async function apiPost(path, payload = {}) {
  const user = await waitForActiveUser();
  if (!user) {
    throw new Error("NOT_LOGGED_IN");
  }

  const token = await user.getIdToken(true);
  const res = await fetch(BACKEND_API_BASE + backendRoute(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify(payload)
  });

  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    data = { ok: false, error: "INVALID_RESPONSE", message: "Backend response was not valid JSON." };
  }

  if (!res.ok || !data.ok) {
    const message = data?.message || data?.error || ("Backend request failed: " + res.status);
    const error = new Error(message);
    error.code = data?.error || "BACKEND_ERROR";
    error.response = data;
    throw error;
  }

  return data;
}


let currentUser = null;
let currentUserData = null;
let pageMode = "credit";
let servicePaymentInfo = null;

function usd(value) {
  return `$${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function bdt(value) {
  return `৳${Number(value || 0).toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;
}

function moneyPair(valueUsd, valueBdt) {
  const amountUsd = normalizeUsd(valueUsd || 0);
  const amountBdt = Number.isFinite(Number(valueBdt)) && Number(valueBdt) > 0 ? Number(valueBdt) : toBdt(amountUsd);
  return `${usd(amountUsd)} / ${bdt(amountBdt)}`;
}

function toBdt(usdAmount) {
  return Math.round(Number(usdAmount || 0) * USD_TO_BDT);
}

function normalizeUsd(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function showMessage(message, type = "info") {
  const box = document.getElementById("walletMessage");
  if (!box) {
    alert(message);
    return;
  }
  box.textContent = message;
  box.className = `wallet-message ${type}`;
  box.style.display = "block";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function createdMillis(data) {
  const ts = data?.createdAt || data?.updatedAt || data?.reviewedAt || data?.approvedAt || data?.declinedAt;
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  const parsed = Date.parse(ts);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusClass(status) {
  const value = String(status || "pending").toLowerCase();
  if (["approved", "accepted", "confirmed", "completed", "delivered"].includes(value)) return "approved";
  if (["processing", "paid_credit_pending_review", "paid_instant_pending_review"].includes(value)) return "processing";
  if (["declined", "cancelled", "rejected", "failed", "expired"].includes(value)) return value === "expired" ? "declined" : value;
  return "pending";
}

function statusLabel(status) {
  const value = String(status || "pending").toLowerCase();
  if (value === "paid_credit_pending_review" || value === "paid_instant_pending_review") return "In Progress";
  if (value === "processing") return "In Progress";
  if (value === "approved" || value === "accepted" || value === "confirmed") return "Approved";
  if (value === "completed" || value === "delivered") return "Completed";
  if (value === "declined" || value === "rejected") return "Declined";
  if (value === "failed") return "Failed";
  if (value === "cancelled") return "Cancelled";
  if (value === "expired") return "Expired";
  return "Pending";
}

function isActionableOrder(status) {
  const value = String(status || "pending").toLowerCase();
  return value === "pending" || value === "paid_credit_pending_review" || value === "paid_instant_pending_review";
}

function adminActionText(data) {
  const status = String(data?.status || "pending").toLowerCase();
  if (status === "processing") return "Auto top-up processing";
  if (status === "delivered") return "Auto top-up delivered";
  if (status === "failed") return "Auto top-up failed";
  if (status === "accepted" || status === "confirmed" || status === "completed") return "Accepted";
  if (status === "declined") return "Declined";
  if (status === "approved") return "Payment confirmed";
  if (status === "cancelled") return "Cancelled by user";
  if (status === "paid_credit_pending_review") return "Paid with credit — review pending";
  if (status === "paid_instant_pending_review") return "Instant payment confirmed — review pending";
  return "Pending review";
}

function adminMetaLine(data) {
  const by = data?.reviewedByEmail || data?.approvedByEmail || data?.declinedByEmail || data?.processedByEmail || data?.paymentConfirmedByEmail || data?.confirmedByEmail || "";
  const status = String(data?.status || "").toLowerCase();
  if (!by) return "";
  if (status === "declined") return `Processed by: ${escapeHtml(by)}`;
  if (status === "approved") return `Confirmed by: ${escapeHtml(by)}`;
  if (status === "accepted" || status === "confirmed" || status === "completed") return `Accepted by: ${escapeHtml(by)}`;
  return `Admin: ${escapeHtml(by)}`;
}

function getOrderDetails(data) {
  return data?.serviceDetails || data?.details || {};
}

function getFreeFireUid(data) {
  const details = getOrderDetails(data);
  return data?.freeFireUid || data?.playerId || details.freeFireUid || details.playerId || details.user_id || details.ff_uid || details.free_fire_uid || details.uid || "";
}

function getFreeFireProductId(data) {
  const details = getOrderDetails(data);
  return data?.fazercardsProductId || data?.productId || data?.product_id || details.fazercardsProductId || details.productId || details.product_id || "";
}

function isFreeFireAutoTopupOrder(data) {
  const name = String(data?.serviceName || "").toLowerCase();
  return name.includes("free fire") && !!getFreeFireUid(data) && !!getFreeFireProductId(data);
}

function autoTopupButtonHtml(data, orderId) {
  if (!isFreeFireAutoTopupOrder(data)) return "";
  const status = String(data?.status || "").toLowerCase();
  if (["processing", "delivered", "completed", "failed"].includes(status)) return "";
  return `<button class="confirm" style="grid-column:1/-1;background:linear-gradient(135deg,#f7b733,#ffffff);color:#080808;" onclick="processFreeFireAutoTopup('${orderId}')">Process Auto Top-up</button>`;
}

function adminOrderDetailsHtml(data) {
  const details = getOrderDetails(data);
  const ffUid = getFreeFireUid(data);
  const productId = getFreeFireProductId(data);
  const providerOrderId = data?.providerOrderId || data?.fazercardsOrderId || "";
  const serviceName = String(data?.serviceName || '').toLowerCase();
  const fieldsType = String(details?.fieldsType || data?.serviceId || '').toLowerCase();

  // iOS panel — don't touch, show minimal
  if (fieldsType.includes('ffios') || serviceName.includes('iphone') || serviceName.includes('ios panel')) {
    return `
      ${ffUid ? `<p><b>Free Fire UID:</b> ${escapeHtml(ffUid)}</p>` : ""}
      ${productId ? `<p><b>Product ID:</b> ${escapeHtml(productId)}</p>` : ""}
      ${providerOrderId ? `<p><b>Provider Order ID:</b> ${escapeHtml(providerOrderId)}</p>` : ""}
    `;
  }

  // Build formatted service detail cards
  const rows = [];
  const skip = new Set(['name','email','phone','service_type','source_page','fieldsType','_amount_usd','_user_uid','_user_email','_payment_method','_payment_status','_amount_bdt','couponCode','discountPercent','originalAmountUsd']);

  // Priority fields shown first with nice labels
  const labelMap = {
    app_name: 'App / Service',
    appName: 'App / Service',
    plan_type: 'Plan',
    planType: 'Plan',
    plan_usd: 'Plan Price (USD)',
    proapp_email: 'Account Email',
    ff_uid: 'Free Fire UID',
    freeFireUid: 'Free Fire UID',
    playerId: 'Player ID',
    packageName: 'Package',
    productName: 'Package',
    ff_drip_variant: 'Drip Variant',
    ff_ff4x_variant: 'FF4X Variant',
    ff_ios_variant: 'iOS Variant',
    ff_pc_variant: 'PC Variant',
    ff_brmods_variant: 'BR Mods Variant',
    drip_email: 'Email',
    ff4x_email: 'Email',
    ios_email: 'Email',
    pc_email: 'Email',
    brmods_email: 'Email',
    website_type: 'Website Type',
    pages: 'Pages',
    features: 'Features',
    existing_url: 'Existing URL',
    app_type: 'App Category',
    target_type: 'Target Type',
    fb_url: 'Facebook URL',
    meta_type: 'Verification Type',
    card_type: 'Card Type',
    card_name: 'Name on Card',
    card_address: 'Delivery Address',
    card_price_package: 'Card Price',
    autoTopupReady: 'Auto Topup',
    provider: 'Provider',
    isMembership: 'Membership',
  };

  const orderedKeys = Object.keys(labelMap).filter(k => details[k] !== undefined && details[k] !== '' && details[k] !== null);
  const extraKeys   = Object.keys(details).filter(k => !skip.has(k) && !labelMap[k] && details[k] !== undefined && details[k] !== '' && details[k] !== null && typeof details[k] !== 'object');

  const allKeys = [...orderedKeys, ...extraKeys];

  allKeys.forEach(k => {
    const label = labelMap[k] || k.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
    let val = details[k];
    if (typeof val === 'boolean') val = val ? 'Yes' : 'No';
    rows.push(`<div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);">
      <span style="min-width:130px;color:#7a7a75;font-size:.78rem;font-weight:700;flex-shrink:0;">${escapeHtml(label)}</span>
      <span style="color:#e1e1e0;font-size:.82rem;word-break:break-all;">${escapeHtml(String(val))}</span>
    </div>`);
  });

  if (!rows.length && !ffUid && !productId) return '';

  return `
    ${ffUid ? `<div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);"><span style="min-width:130px;color:#7a7a75;font-size:.78rem;font-weight:700;flex-shrink:0;">Free Fire UID</span><span style="color:#ffffff;font-size:.88rem;font-weight:900;">${escapeHtml(ffUid)}</span></div>` : ""}
    ${productId ? `<div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);"><span style="min-width:130px;color:#7a7a75;font-size:.78rem;font-weight:700;flex-shrink:0;">Product ID</span><span style="color:#e1e1e0;font-size:.82rem;">${escapeHtml(productId)}</span></div>` : ""}
    ${providerOrderId ? `<div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);"><span style="min-width:130px;color:#7a7a75;font-size:.78rem;font-weight:700;flex-shrink:0;">Provider Order ID</span><span style="color:#e1e1e0;font-size:.82rem;">${escapeHtml(providerOrderId)}</span></div>` : ""}
    ${rows.length ? `<div style="margin-top:10px;background:rgba(0,10,20,.35);border:1px solid rgba(255, 255, 255,.10);border-radius:12px;padding:4px 12px 2px;">
      <div style="font-size:.7rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#555552;padding:8px 0 4px;">Order Details</div>
      ${rows.join('')}
    </div>` : ''}
  `;
}


function openLoginOrHome() {
  if (window.rabbiAuth && typeof window.rabbiAuth.openLogin === "function") {
    window.rabbiAuth.openLogin();
  } else {
    window.location.href = "/";
  }
}

async function waitForActiveUser(timeoutMs = 8000) {
  if (auth.currentUser) return auth.currentUser;
  if (window.rabbiAuth && typeof window.rabbiAuth.getUser === "function" && window.rabbiAuth.getUser()) {
    return window.rabbiAuth.getUser();
  }
  try {
    if (typeof auth.authStateReady === "function") await auth.authStateReady();
  } catch (e) {}
  if (auth.currentUser) return auth.currentUser;
  if (window.rabbiAuth && typeof window.rabbiAuth.getUser === "function" && window.rabbiAuth.getUser()) {
    return window.rabbiAuth.getUser();
  }
  if (!hasCachedUser()) return null;

  return await new Promise((resolve) => {
    let settled = false;
    let unsubscribe = null;
    const finish = (user) => {
      if (settled) return;
      settled = true;
      if (unsubscribe) unsubscribe();
      resolve(user || null);
    };

    unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) finish(user);
    });

    setTimeout(() => {
      const fallback = window.rabbiAuth && typeof window.rabbiAuth.getUser === "function" ? window.rabbiAuth.getUser() : null;
      finish(auth.currentUser || fallback || null);
    }, timeoutMs);
  });
}

async function ensureUserDoc(user) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      name: user.displayName || "User",
      email: user.email || "",
      photoURL: user.photoURL || "",
      credit: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else {
    const data = snap.data();
    await updateDoc(userRef, {
      name: user.displayName || data.name || "User",
      email: user.email || data.email || "",
      updatedAt: serverTimestamp()
    });
  }
}

function listenUserCredit(user) {
  const userRef = doc(db, "users", user.uid);
  onSnapshot(userRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    currentUserData = data;
    setText("userCredit", moneyPair(data.credit));
    setText("miniCredit", moneyPair(data.credit));
    // Nav profile menu balance is owned by auth.js but may already be on
    // screen — update it here too so it never lags behind Firestore.
    const pm = document.getElementById("profileMenuBalance");
    if (pm) { pm.dataset.rhLive = '1'; pm.textContent = moneyPair(data.credit); }
    // Keep balance cache fresh so next page load shows correct balance instantly
    try {
      const cached = JSON.parse(localStorage.getItem('rh_user_cache') || '{}');
      cached.balance = moneyPair(data.credit);
      cached.credit_raw = data.credit || 0;
      cached.cache_ts = Date.now();
      localStorage.setItem('rh_user_cache', JSON.stringify(cached));
    } catch(e) {}
  });
}

function getSelectedUsdAmount() {
  const amountEl = document.getElementById("amount");
  const amountValue = amountEl ? amountEl.value : "1";
  const customAmount = Number(document.getElementById("customAmount")?.value || 0);
  return amountValue === "custom" ? customAmount : Number(amountValue || 0);
}

function loadPendingServiceDetails() {
  try {
    const raw = sessionStorage.getItem("pendingServicePayment");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function setupPageMode() {
  const mode = getParam("mode");
  const serviceName = getParam("service");
  const usdParam = Number(getParam("usd") || 0);

  if (mode === "service" && serviceName) {
    pageMode = "service";
    servicePaymentInfo = loadPendingServiceDetails() || {};
    servicePaymentInfo.serviceName = decodeURIComponent(serviceName);
    servicePaymentInfo.amountUsd = usdParam || Number(servicePaymentInfo.amountUsd || 1);

    document.body.classList.add("service-payment-mode");
    setText("walletPageTitle", "Instant Service Payment");
    setText("walletPageSub", "Send the service payment manually. Once verified, the service request will be activated.");
    setText("paymentPurpose", `Service: ${servicePaymentInfo.serviceName}`);

    const amountEl = document.getElementById("amount");
    const customWrap = document.getElementById("customAmountWrap");
    const customAmount = document.getElementById("customAmount");
    if (amountEl && customAmount) {
      amountEl.value = "custom";
      customAmount.value = String(servicePaymentInfo.amountUsd);
      if (customWrap) customWrap.style.display = "block";
    }
  } else {
    pageMode = "credit";
    setText("paymentPurpose", "Wallet Credit Top-up");
  }
}

function hasCachedUser() {
  try {
    const c = JSON.parse(localStorage.getItem("rh_user_cache") || "null");
    return !!(c && c.uid);
  } catch (e) {
    return false;
  }
}

function isAuthDefaultPhoto(url) {
  return /googleusercontent\.com|ggpht\.com|gravatar\.com/i.test(String(url || ""));
}

function pickDashPhoto(data, user, cached) {
  const fromDoc = data && data.photoURL ? data.photoURL : "";
  let stored = "";
  try { stored = localStorage.getItem("rh_photo_custom") || ""; } catch (e) {}
  const fromCache = (cached && cached.photoURL) || "";
  const fromAuth = user && user.photoURL ? user.photoURL : "";
  if (fromDoc && !isAuthDefaultPhoto(fromDoc)) {
    try { localStorage.setItem("rh_photo_custom", fromDoc); } catch (e) {}
    return fromDoc;
  }
  if (stored && !isAuthDefaultPhoto(stored)) return stored;
  if (fromCache && !isAuthDefaultPhoto(fromCache)) {
    try { localStorage.setItem("rh_photo_custom", fromCache); } catch (e) {}
    return fromCache;
  }
  return fromDoc || stored || fromCache || fromAuth || "";
}

window.loadWalletPage = function () {
  setupPageMode();
  window.updatePaymentNumber();
  window.handleAmountChange();

  const applyWalletUser = async (user) => {
    const authRequired = document.getElementById("authRequired");
    const walletContent = document.getElementById("walletContent");

    if (!user) {
      if (hasCachedUser()) return;
      if (authRequired) authRequired.style.display = "block";
      if (walletContent) walletContent.style.display = "none";
      return;
    }

    currentUser = user;
    if (authRequired) authRequired.style.display = "none";
    if (walletContent) walletContent.style.display = "grid";

    await ensureUserDoc(user);
    listenUserCredit(user);
    setText("userEmail", user.email || "No email");
    setText("userName", user.displayName || user.email || "User");
    window.loadMyTopups();
  };

  (async () => {
    try {
      if (typeof auth.authStateReady === "function") await auth.authStateReady();
    } catch (e) {}
    applyWalletUser(auth.currentUser);
  })();

  onAuthStateChanged(auth, applyWalletUser);
};

window.updatePaymentNumber = function () {
  const methodEl = document.getElementById("paymentMethod");
  const method = methodEl ? methodEl.value : "bKash";
  setText("paymentNumber", PAYMENT_NUMBERS[method] || "Select payment method");
  setText("selectedMethod", method || "bKash");
};

window.handleAmountChange = function () {
  const amountEl = document.getElementById("amount");
  const customWrap = document.getElementById("customAmountWrap");
  const selectedUsd = document.getElementById("selectedUsdAmount");
  const selectedBdt = document.getElementById("selectedBdtAmount");
  if (!amountEl) return;

  const isCustom = amountEl.value === "custom";
  if (customWrap) customWrap.style.display = isCustom ? "block" : "none";

  const amountUsd = getSelectedUsdAmount();
  if (selectedUsd) selectedUsd.textContent = amountUsd ? usd(amountUsd) : "Custom Amount";
  if (selectedBdt) selectedBdt.textContent = amountUsd ? bdt(toBdt(amountUsd)) : "0 BDT";
  const mirror = document.getElementById("selectedBdtMirror");
  if (mirror) mirror.textContent = amountUsd ? bdt(toBdt(amountUsd)) : "৳0";
};

window.copyTextValue = async function (targetId, label = "Text") {
  const el = document.getElementById(targetId);
  if (!el) return;
  const text = el.textContent.trim();

  try {
    if (navigator.clipboard) await navigator.clipboard.writeText(text);
    else {
      const temp = document.createElement("textarea");
      temp.value = text;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand("copy");
      document.body.removeChild(temp);
    }
    showMessage(`${label} copied: ${text}`, "success");
  } catch (err) {
    showMessage("Copy failed. Please copy manually.", "error");
  }
};

// wallet.js submitTopup — delegates to _submitTopupInternal (new add-credit.html flow)
window.submitTopup = async function () {
  const method = document.getElementById('paymentMethod')?.value;
  const transactionId = document.getElementById('transactionId')?.value.trim();
  if (window._submitTopupInternal) {
    window._submitTopupInternal({
      method: method || '',
      transactionId: transactionId || '',
      msgEl: 'walletMessage',
      btnEl: 'submitTopupBtn',
      onSuccess: typeof window.showVerifyingOverlay === 'function' ? window.showVerifyingOverlay : () => {}
    });
  }
};

// ── Shared submit helper — used by add-credit.html for Binance & Coin ──
window._submitTopupInternal = async function({ method, transactionId, msgEl, btnEl, onSuccess }) {
  const user = await waitForActiveUser();
  if (!user) {
    const el = document.getElementById(msgEl);
    if (el) { el.textContent = 'Login first.'; el.className = 'wallet-message error'; el.style.display = 'block'; }
    openLoginOrHome();
    return;
  }
  currentUser = user;

  const amountUsd = normalizeUsd(window._currentSelectedUsd ? window._currentSelectedUsd() : 0);
  const amountBdt = toBdt(amountUsd);

  if (!amountUsd || amountUsd < 1) {
    const el = document.getElementById(msgEl);
    if (el) { el.textContent = 'A minimum of $1 is required.'; el.className = 'wallet-message error'; el.style.display = 'block'; }
    return;
  }
  if (!transactionId || transactionId.length < 5) {
    const el = document.getElementById(msgEl);
    if (el) { el.textContent = 'Provide a valid Transaction ID / Hash.'; el.className = 'wallet-message error'; el.style.display = 'block'; }
    return;
  }

  const btn = document.getElementById(btnEl);
  if (btn) { btn.disabled = true; btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="animation:spin .7s linear infinite;vertical-align:-3px;margin-right:6px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Submitting…'; }

  try {
    await ensureUserDoc(user);

    const payload = {
      userId: user.uid,
      userName: user.displayName || 'User',
      userEmail: user.email || '',
      purpose: 'credit',
      serviceName: '',
      serviceDetails: {},
      amountUsd,
      amountUSD: amountUsd,
      amountBdt,
      amountBDT: amountBdt,
      rate: USD_TO_BDT,
      rateBDT: USD_TO_BDT,
      method,
      transactionId,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // ── Duplicate transaction ID guard ──
    const { doc: fsDoc2, setDoc: fsSetDoc2, getDoc: fsGetDoc2 } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
    const lockRef = fsDoc2(db, 'txnLocks', transactionId);
    const lockSnap = await fsGetDoc2(lockRef);
    if (lockSnap.exists()) {
      const el = document.getElementById(msgEl);
      if (el) { el.textContent = 'This Transaction ID has already been used. Enter a new one.'; el.className = 'wallet-message error'; el.style.display = 'block'; }
      if (btn) { btn.disabled = false; btn.textContent = 'Verify Payment'; }
      return;
    }
    // Claim the txnId atomically
    await fsSetDoc2(lockRef, { userId: user.uid, txnId: transactionId, createdAt: serverTimestamp() });

    const ref = await addDoc(collection(db, 'topups'), payload);
    if (typeof onSuccess === 'function') onSuccess(ref.id, { method, amountUsd, amountBdt, transactionId, userName: user.displayName || 'User', userEmail: user.email || '' });
  } catch (err) {

    const el = document.getElementById(msgEl);
    if (el) { el.textContent = err.message || 'Payment submit failed. Try again.'; el.className = 'wallet-message error'; el.style.display = 'block'; }
    if (btn) { btn.disabled = false; btn.textContent = 'Verify Payment'; }
  }
};

// Expose Firestore primitives so add-credit.html verifying overlay can listen
window._db = db;
window._onSnapshot = onSnapshot;
window._doc = doc;
window._collection = collection;

window.loadMyTopups = function () {
  if (!currentUser) return;
  const list = document.getElementById("myTopupList");
  if (!list) return;

  const q = query(collection(db, "topups"), where("userId", "==", currentUser.uid));

  onSnapshot(q, (snapshot) => {
    list.innerHTML = "";

    if (snapshot.empty) {
      list.innerHTML = `<div class="empty-state">No payment request found.</div>`;
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.innerHTML += `
        <div class="request-card">
          <div>
            <strong>${moneyPair(data.amountUsd || data.amountUSD || data.amount || 0, data.amountBdt || data.amountBDT)}</strong>
            <span class="status ${escapeHtml(data.status)}">${escapeHtml(data.status)}</span>
          </div>
          <p>Purpose: ${escapeHtml(data.purpose || "credit")}${data.serviceName ? " — " + escapeHtml(data.serviceName) : ""}</p>
          <p>Method: ${escapeHtml(data.method)}</p>
          <p>Transaction ID: ${escapeHtml(data.transactionId)}</p>
        </div>
      `;
    });
  });
};

window.buyServiceWithCredit = async function (servicePayload) {
  const user = await waitForActiveUser();
  if (!user) {
    return { ok: false, reason: "login", message: "Please login first." };
  }

  const amountUsd = normalizeUsd(servicePayload?.amountUsd || servicePayload?.amountUSD || servicePayload?._amount_usd || 0);
  if (!amountUsd || amountUsd < 0.1) {
    return { ok: false, reason: "amount", message: "Valid service amount required." };
  }

  try {
    await ensureUserDoc(user);

    const result = await apiPost("/api/buy-service", {
      serviceName: servicePayload.serviceName || "Service",
      serviceId: servicePayload.fieldsType || servicePayload.serviceId || "service",
      amountUsd,
      serviceDetails: servicePayload.details || {}
    });

    return {
      ok: true,
      orderId: result.orderId,
      amountUsd,
      amountBdt: toBdt(amountUsd),
      newCredit: result.newCredit
    };
  } catch (error) {
    if (error.code === "NOT_LOGGED_IN") {
      return { ok: false, reason: "login", message: "Please login first." };
    }
    if (error.code === "INSUFFICIENT_BALANCE" || /insufficient/i.test(error.message || "")) {
      return { ok: false, reason: "insufficient", message: "Insufficient balance. Please add credit." };
    }
    if (error.code === "INVALID_PRICE") {
      return { ok: false, reason: "amount", message: "Invalid service price." };
    }
    if (/permission/i.test(error.message || "") || error.code === "ADMIN_ONLY") {
      return { ok: false, reason: "permission", message: error.message || "Permission denied." };
    }
    return { ok: false, reason: "error", message: error.message || "Credit payment failed." };
  }
};

window.showAdminHistoryPanel = function (panel) {
  const serviceSection = document.getElementById("adminServiceHistorySection");
  const paymentSection = document.getElementById("adminPaymentHistorySection");
  const serviceBtn = document.getElementById("showServiceHistoryBtn");
  const paymentBtn = document.getElementById("showPaymentHistoryBtn");

  const showService = panel === "service";
  if (serviceSection) serviceSection.style.display = showService ? "block" : "none";
  if (paymentSection) paymentSection.style.display = showService ? "none" : "block";
  if (serviceBtn) serviceBtn.classList.toggle("active", showService);
  if (paymentBtn) paymentBtn.classList.toggle("active", !showService);
};

window.loadAdminPanel = function () {
  const ACCESS_DENIED = `<main style="min-height:100vh;display:grid;place-items:center;background:#080808;color:#f7f7f4;padding:24px;font-family:system-ui,sans-serif;"><section style="width:min(560px,100%);border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:clamp(30px,6vw,52px);background:#111;"><span style="display:grid;width:48px;height:48px;place-items:center;border-radius:50%;background:#fff;color:#000;margin-bottom:24px;">→</span><p style="margin:0 0 12px;color:#888;font-size:12px;letter-spacing:.14em;text-transform:uppercase;">RabbiHossainLTD · Admin</p><h1 style="margin:0 0 14px;font-size:clamp(32px,7vw,58px);line-height:1.02;letter-spacing:-.04em;">Access restricted</h1><p style="margin:0 0 30px;color:#aaa;line-height:1.75;">This page is for authorized administrator accounts only. Sign in with the correct account.</p><a href="/" style="display:inline-flex;min-height:46px;align-items:center;padding:0 22px;border-radius:999px;background:#fff;color:#080808;text-decoration:none;font-weight:800;">Back to website</a></section></main>`;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      document.body.innerHTML = ACCESS_DENIED;
      return;
    }

    const adminRef = doc(db, "admins", user.uid);
    const adminSnap = await getDoc(adminRef);
    const emailIsAdmin = ADMIN_EMAILS.includes(String(user.email || "").toLowerCase());

    if (!adminSnap.exists() && !emailIsAdmin) {
      document.body.innerHTML = ACCESS_DENIED;
      return;
    }

    const topupList = document.getElementById("adminTopupList");
    const orderList = document.getElementById("adminOrderList");
    const topupHistoryList = document.getElementById("adminTopupHistoryList");
    const orderHistoryList = document.getElementById("adminOrderHistoryList");
    const adminInfo = document.getElementById("adminInfo");

    if (adminInfo) adminInfo.textContent = `Logged in as ${user.email || "Admin"}`;

    const topupQuery = query(
      collection(db, "topups"),
      where("status", "==", "pending")
    );
    onSnapshot(topupQuery, (snapshot) => {
      if (!topupList) return;
      topupList.innerHTML = "";

      if (snapshot.empty) {
        topupList.innerHTML = `<div class="empty-state">No pending payment request.</div>`;
        return;
      }

      const docs = [];
      snapshot.forEach((docSnap) => docs.push(docSnap));
      docs.sort((a, b) => createdMillis(b.data()) - createdMillis(a.data()));

      docs.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const purpose = data.purpose || "credit";
        const details = data.serviceDetails || {};
        topupList.innerHTML += `
          <div class="admin-card">
            <div class="admin-card-head">
              <h3>${moneyPair(data.amountUsd || data.amountUSD || data.amount || 0, data.amountBdt || data.amountBDT)}</h3>
              <span class="status pending">${statusLabel('pending')}</span>
            </div>
            <p><b>Purpose:</b> ${escapeHtml(purpose)}${data.serviceName ? " — " + escapeHtml(data.serviceName) : ""}</p>
            <p><b>User:</b> ${escapeHtml(data.userName || "User")}</p>
            <p><b>Email:</b> ${escapeHtml(data.userEmail || "No email")}</p>
            <p><b>Method:</b> ${escapeHtml(data.method || "Manual")}</p>
            <p><b>Number:</b> ${escapeHtml(data.paymentNumber || "")}</p>
            <p><b>Transaction ID:</b> ${escapeHtml(data.transactionId || "")}</p>
            ${purpose === "service" ? `<div class="admin-details"><b>Service Details:</b><pre>${escapeHtml(JSON.stringify(details, null, 2))}</pre></div>` : ""}
            <div class="actions">
              <button class="btn-confirm" onclick="approveTopup('${docSnap.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><path d="M20 6 9 17l-5-5"/></svg>
                Approve
              </button>
              <button class="btn-decline" onclick="declineTopup('${docSnap.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><path d="M18 6 6 18M6 6l12 12"/></svg>
                Decline
              </button>
            </div>
          </div>
        `;
      });
    });

    const orderQuery = query(
      collection(db, "serviceOrders"),
      where("status", "in", ["pending", "processing"])
    );
    onSnapshot(orderQuery, (snapshot) => {
      if (!orderList) return;
      orderList.innerHTML = "";

      if (snapshot.empty) {
        orderList.innerHTML = `<div class="empty-state">No pending service order.</div>`;
        return;
      }

      const pendingDocs = [];
      snapshot.forEach((docSnap) => pendingDocs.push(docSnap));
      pendingDocs.sort((a, b) => createdMillis(b.data()) - createdMillis(a.data()));

      pendingDocs.forEach((docSnap) => {
        const data = docSnap.data() || {};
        orderList.innerHTML += `
          <div class="admin-card">
            <div class="admin-card-head">
              <h3>${escapeHtml(data.serviceName || "Service")}</h3>
              <span class="status ${statusClass(data.status)}">${statusLabel(data.status)}</span>
            </div>
            <p><b>Amount:</b> ${moneyPair(data.amountUsd || data.amountUSD, data.amountBdt || data.amountBDT)}</p>
            <p><b>Payment:</b> ${escapeHtml(data.paymentMethod || "credit")}</p>
            <p><b>User:</b> ${escapeHtml(data.userName || "User")}</p>
            <p><b>Email:</b> ${escapeHtml(data.userEmail || "No email")}</p>
            ${data.transactionId ? `<p><b>Transaction ID:</b> ${escapeHtml(data.transactionId)}</p>` : ""}
            ${adminOrderDetailsHtml(data)}
            <div class="actions">
              <button class="btn-confirm" onclick="approveServiceOrder('${docSnap.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><path d="M20 6 9 17l-5-5"/></svg>
                Accept
              </button>
              <button class="btn-decline" onclick="declineServiceOrder('${docSnap.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><path d="M18 6 6 18M6 6l12 12"/></svg>
                Decline
              </button>
              ${autoTopupButtonHtml(data, docSnap.id)}
            </div>
          </div>
        `;
      });
    });

    const topupHistoryQuery = query(collection(db, "topups"));
    onSnapshot(topupHistoryQuery, (snapshot) => {
      if (!topupHistoryList) return;
      const docs = [];
      snapshot.forEach((docSnap) => docs.push(docSnap));
      docs.sort((a, b) => createdMillis(b.data()) - createdMillis(a.data()));
      const limited = docs.slice(0, 80);
      topupHistoryList.innerHTML = "";
      if (!limited.length) {
        topupHistoryList.innerHTML = `<div class="empty-state">No payment transaction history yet.</div>`;
        return;
      }
      limited.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const purpose = data.purpose || "credit";
        topupHistoryList.innerHTML += `
          <div class="admin-card history-card">
            <div class="admin-card-head">
              <h3>${purpose === "service" ? escapeHtml(data.serviceName || "Instant Service Payment") : "Credit Top-up"}</h3>
              <span class="status ${statusClass(data.status)}">${statusLabel(data.status)}</span>
            </div>
            <p><b>Amount:</b> ${moneyPair(data.amountUsd || data.amountUSD || data.amount || 0, data.amountBdt || data.amountBDT)}</p>
            <p><b>User:</b> ${escapeHtml(data.userName || "User")} — ${escapeHtml(data.userEmail || "No email")}</p>
            <p><b>Method:</b> ${escapeHtml(data.method || "Manual")} ${data.transactionId ? "• TX: " + escapeHtml(data.transactionId) : ""}</p>
            <p><b>Admin Action:</b> ${adminActionText(data)}${adminMetaLine(data) ? " • " + adminMetaLine(data) : ""}</p>
          </div>
        `;
      });
    });

    const orderHistoryQuery = query(collection(db, "serviceOrders"));
    onSnapshot(orderHistoryQuery, (snapshot) => {
      if (!orderHistoryList) return;
      const docs = [];
      snapshot.forEach((docSnap) => docs.push(docSnap));
      docs.sort((a, b) => createdMillis(b.data()) - createdMillis(a.data()));
      const limited = docs.slice(0, 100);
      orderHistoryList.innerHTML = "";
      if (!limited.length) {
        orderHistoryList.innerHTML = `<div class="empty-state">No service transaction history yet.</div>`;
        return;
      }
      limited.forEach((docSnap) => {
        const data = docSnap.data() || {};
        orderHistoryList.innerHTML += `
          <div class="admin-card history-card">
            <div class="admin-card-head">
              <h3>${escapeHtml(data.serviceName || "Service")}</h3>
              <span class="status ${statusClass(data.status)}">${statusLabel(data.status)}</span>
            </div>
            <p><b>Amount:</b> ${moneyPair(data.amountUsd || data.amountUSD, data.amountBdt || data.amountBDT)}</p>
            <p><b>User:</b> ${escapeHtml(data.userName || "User")} — ${escapeHtml(data.userEmail || "No email")}</p>
            <p><b>Payment:</b> ${escapeHtml(data.paymentMethod || "credit")}${data.transactionId ? " • TX: " + escapeHtml(data.transactionId) : ""}</p>
            <p><b>Admin Action:</b> ${adminActionText(data)}${adminMetaLine(data) ? " • " + adminMetaLine(data) : ""}</p>
            ${adminOrderDetailsHtml(data)}
          </div>
        `;
      });
    });

    // ── Support History (Solved only) ──
    const supportHistoryList = document.getElementById("adminSupportHistoryList");
    if (supportHistoryList) {
      onSnapshot(collection(db, "supportRooms"), (snapshot) => {
        supportHistoryList.innerHTML = "";
        const solvedDocs = snapshot.docs
          .filter(d => d.data().status === "solved")
          .sort((a, b) => {
            const ta = a.data().lastAt?.toMillis ? a.data().lastAt.toMillis() : 0;
            const tb = b.data().lastAt?.toMillis ? b.data().lastAt.toMillis() : 0;
            return tb - ta;
          });
        if (solvedDocs.length === 0) {
          supportHistoryList.innerHTML = `<div class="empty-state">No solved support tickets.</div>`;
          return;
        }
        solvedDocs.forEach((docSnap) => {
          const d = docSnap.data() || {};
          const uid = docSnap.id;
          const lastAt = d.lastAt?.toDate ? d.lastAt.toDate().toLocaleDateString() : '';
          supportHistoryList.innerHTML += `
            <div class="admin-card history-card" style="cursor:pointer;" onclick="window.adminShowSolvedChat && window.adminShowSolvedChat('${escapeHtml(uid)}')">
              <div class="admin-card-head">
                <div>
                  <h3>🟢 ${escapeHtml(d.displayName || d.userEmail || "User")}</h3>
                  ${d.ticketId ? `<p style="font-family:monospace;font-size:.68rem;color:#7a7a75;">#${escapeHtml(d.ticketId)}</p>` : ''}
                </div>
                <span class="status completed">Solved</span>
              </div>
              <p>📧 ${escapeHtml(d.userEmail || "—")} &nbsp;|&nbsp; 📞 ${escapeHtml(d.userPhone || "—")}</p>
              <p>Last: ${escapeHtml(d.lastMessage || "—")}</p>
              ${lastAt ? `<p style="color:#70706d;font-size:.7rem;">Date: ${lastAt}</p>` : ''}
            </div>
          `;
        });
      });
    }
  });
};

window.approveTopup = async function (topupId) {
  if (!confirm("Confirm this payment and add credit?")) return;
  try {
    await apiPost("/api/confirm-topup", { topupId });
    alert("Payment approved. Credit added atomically by the backend.");
  } catch (error) {
    alert(error.message || "Approval failed.");
  }
};

window.declineTopup = async function (topupId) {
  if (!confirm("Decline this payment request?")) return;
  try {
    await apiPost("/api/decline-topup", { topupId, reason: "Declined by admin" });
    alert("Payment request declined.");
  } catch (error) {
    alert(error.message || "Decline failed.");
  }
};

// ── Payment Declined full-screen animation ──
window.showPaymentDeclinedOverlay = function(reason) {
  const old = document.getElementById('verifyOverlay');
  if (old) old.remove();
  if (!document.getElementById('rhDeclinedAnimStyle')) {
    const s = document.createElement('style');
    s.id = 'rhDeclinedAnimStyle';
    s.textContent = `
      @keyframes rhDecIn{from{opacity:0;transform:scale(.88) translateY(24px)}to{opacity:1;transform:none}}
      @keyframes rhDecRing{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.6);opacity:0}}
      @keyframes rhDecX{from{stroke-dashoffset:36}to{stroke-dashoffset:0}}
      @keyframes rhDecShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}
    `;
    document.head.appendChild(s);
  }
  const ov = document.createElement('div');
  ov.id = 'verifyOverlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(4,6,8,.97);backdrop-filter:blur(14px);padding:20px;';
  ov.innerHTML = `
    <div style="width:min(420px,100%);border-radius:28px;padding:36px 28px 28px;text-align:center;
      background:linear-gradient(180deg,rgba(255,60,60,.10) 0%,rgba(4,6,8,.97) 100%);
      border:1px solid rgba(255,60,60,.32);
      box-shadow:0 40px 100px rgba(0,0,0,.6),0 0 60px rgba(255,60,60,.08);
      animation:rhDecIn .5s cubic-bezier(.2,1,.2,1) both;">
      <div style="position:relative;width:88px;height:88px;margin:0 auto 22px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:88px;height:88px;border-radius:50%;border:2px solid rgba(255,60,60,.28);animation:rhDecRing 1.8s ease-out infinite;"></div>
        <div style="width:72px;height:72px;border-radius:50%;background:rgba(255,60,60,.12);border:2px solid rgba(255,60,60,.45);display:flex;align-items:center;justify-content:center;animation:rhDecShake .5s ease .2s both;">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ff5050" stroke-width="2.5" stroke-linecap="round" style="stroke-dasharray:36;stroke-dashoffset:36;animation:rhDecX .45s ease .3s forwards;"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </div>
      </div>
      <div style="display:inline-flex;align-items:center;gap:7px;padding:5px 14px;border-radius:999px;background:rgba(255,60,60,.10);border:1px solid rgba(255,60,60,.28);color:#ffb0b0;font-size:.7rem;font-weight:900;letter-spacing:.07em;text-transform:uppercase;margin-bottom:14px;">
        <span style="width:7px;height:7px;border-radius:50%;background:#ff5050;display:inline-block;"></span>Payment Declined
      </div>
      <h2 style="font-size:1.55rem;color:#f8f8f7;margin:0 0 10px;font-weight:800;">Payment Declined</h2>
      <p style="color:#a5a5a1;line-height:1.72;margin:0 0 16px;font-size:.93rem;">Your payment request has been declined.</p>
      ${reason ? `<p style="color:#ff8080;font-size:.84rem;margin:0 0 20px;background:rgba(255,60,60,.08);border:1px solid rgba(255,60,60,.18);border-radius:12px;padding:10px 14px;">${reason}</p>` : '<p style="color:#82827d;font-size:.84rem;margin:0 0 20px;">Contact support if you have any issues.</p>'}
      <button type="button" onclick="window.location.href='/add-credit/'"
        style="width:100%;border:none;border-radius:16px;padding:15px;background:linear-gradient(135deg,#ff5050,#ff8050);color:#fff;font-weight:900;font-size:.96rem;cursor:pointer;box-shadow:0 12px 32px rgba(255,60,60,.25);margin-bottom:10px;">
        Try Again
      </button>
      <button type="button" onclick="window.location.href='/dashboard/'"
        style="width:100%;border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:12px;background:rgba(255,255,255,.05);color:#a5a5a1;font-weight:800;font-size:.88rem;cursor:pointer;">
        Go to Dashboard
      </button>
    </div>`;
  document.body.appendChild(ov);
};

// ── Invoice PDF Generator ──
window.downloadInvoice = function(data, docId) {
  const d = data || {};
  const amountUsd = Number(d.amountUsd || d.amountUSD || d.amount || 0);
  const amountBdt = Number(d.amountBdt || d.amountBDT || Math.round(amountUsd * 125));
  const method    = d.method || d.paymentMethod || 'N/A';
  const txnId     = d.transactionId || d.orderId || docId || 'N/A';
  const dateTs    = d.createdAt?.toMillis ? d.createdAt.toMillis() : (d.createdAt?.seconds||0)*1000;
  const dateStr   = dateTs ? new Date(dateTs).toLocaleString('en-GB', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : new Date().toLocaleString();
  const userName  = d.userName || d.name || 'Customer';
  const userEmail = d.userEmail || d.email || '';
  const rate      = d.rate || d.rateBDT || 125;
  const purpose   = d.purpose === 'service' ? (d.serviceName || 'Service Payment') : 'Wallet Credit Top-up';
  const status    = (d.status || 'pending').toUpperCase();
  const invNum    = 'INV-' + (docId || Date.now()).toString().slice(-8).toUpperCase();
  const website   = 'rabbihossainltd.online';

  // Build SVG invoice
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842" font-family="Arial, sans-serif">
  <!-- Background -->
  <rect width="595" height="842" fill="#080808"/>
  <!-- Header band -->
  <rect width="595" height="120" fill="#10100f"/>
  <rect width="595" height="3" y="120" fill="#ffffff" opacity="0.5"/>
  <!-- Company name -->
  <text x="40" y="52" font-size="26" font-weight="bold" fill="#ffffff" letter-spacing="1">RabbiHossainLTD</text>
  <text x="40" y="74" font-size="11" fill="#aaaaaa">Operated by Md Rabbi Hossain</text>
  <text x="40" y="92" font-size="10" fill="#70706d">${website}</text>
  <!-- INVOICE label -->
  <text x="555" y="52" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="end" letter-spacing="2">INVOICE</text>
  <text x="555" y="72" font-size="11" fill="#aaaaaa" text-anchor="end">${invNum}</text>
  <text x="555" y="90" font-size="10" fill="#70706d" text-anchor="end">${dateStr}</text>
  <!-- Status badge -->
  <rect x="430" y="100" width="125" height="24" rx="12" fill="${status === 'APPROVED' || status === 'COMPLETED' ? '#1b1b19' : status === 'DECLINED' ? '#220000' : '#1a1200'}" stroke="${status === 'APPROVED' || status === 'COMPLETED' ? '#ffffff' : status === 'DECLINED' ? '#ff5050' : '#ffa500'}" stroke-width="1"/>
  <text x="492" y="116" font-size="10" font-weight="bold" fill="${status === 'APPROVED' || status === 'COMPLETED' ? '#ffffff' : status === 'DECLINED' ? '#ff5050' : '#ffa500'}" text-anchor="middle">${status}</text>
  <!-- Billed To -->
  <text x="40" y="160" font-size="10" font-weight="bold" fill="#70706d" letter-spacing="1.5">BILLED TO</text>
  <text x="40" y="180" font-size="14" font-weight="bold" fill="#ededec">${userName}</text>
  <text x="40" y="198" font-size="11" fill="#aaaaaa">${userEmail}</text>
  <!-- Divider -->
  <line x1="40" y1="230" x2="555" y2="230" stroke="#1b1b1a" stroke-width="1"/>
  <!-- Table header -->
  <rect x="40" y="240" width="515" height="34" rx="6" fill="#10100f"/>
  <text x="56" y="262" font-size="10" font-weight="bold" fill="#aaaaaa" letter-spacing="1">DESCRIPTION</text>
  <text x="360" y="262" font-size="10" font-weight="bold" fill="#aaaaaa" letter-spacing="1">METHOD</text>
  <text x="490" y="262" font-size="10" font-weight="bold" fill="#aaaaaa" letter-spacing="1" text-anchor="end">AMOUNT</text>
  <!-- Row -->
  <rect x="40" y="282" width="515" height="50" rx="6" fill="#0e0e0d"/>
  <text x="56" y="304" font-size="12" font-weight="bold" fill="#f7f7f4">${purpose}</text>
  <text x="56" y="320" font-size="10" fill="#70706d">Transaction: ${txnId}</text>
  <text x="360" y="311" font-size="12" fill="#e4e4e0">${method}</text>
  <text x="490" y="311" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="end">$${amountUsd.toFixed(2)}</text>
  <!-- Divider -->
  <line x1="40" y1="342" x2="555" y2="342" stroke="#1b1b1a" stroke-width="1"/>
  <!-- Rate info -->
  <text x="40" y="368" font-size="10" fill="#70706d">Exchange Rate: $1 = ৳${rate}</text>
  <!-- Totals -->
  <text x="390" y="368" font-size="11" fill="#aaaaaa">Subtotal (USD)</text>
  <text x="555" y="368" font-size="13" font-weight="bold" fill="#f7f7f4" text-anchor="end">$${amountUsd.toFixed(2)}</text>
  <text x="390" y="392" font-size="11" fill="#aaaaaa">Amount (BDT)</text>
  <text x="555" y="392" font-size="13" font-weight="bold" fill="#e4e4e0" text-anchor="end">৳${amountBdt.toLocaleString()}</text>
  <line x1="380" y1="402" x2="555" y2="402" stroke="#232322" stroke-width="1"/>
  <!-- Total -->
  <rect x="370" y="410" width="185" height="38" rx="8" fill="#1e1e1d"/>
  <text x="386" y="434" font-size="12" font-weight="bold" fill="#ffffff">TOTAL PAID</text>
  <text x="549" y="434" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="end">$${amountUsd.toFixed(2)}</text>
  <!-- Footer -->
  <line x1="40" y1="790" x2="555" y2="790" stroke="#1b1b1a" stroke-width="1"/>
  <text x="297" y="810" font-size="10" fill="#454542" text-anchor="middle">RabbiHossainLTD · ${website} · support@rabbihossainltd.online</text>
  <text x="297" y="826" font-size="9" fill="#2f2f2d" text-anchor="middle">This is a computer-generated invoice. No signature required.</text>
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `RabbiHossainLTD-Invoice-${invNum}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

window.approveServiceOrder = async function (orderId) {
  if (!confirm("Confirm this service order?")) return;
  try {
    await apiPost("/api/confirm-order", { orderId });
    alert("Service order confirmed.");
  } catch (error) {
    alert(error.message || "Confirm failed.");
  }
};

window.declineServiceOrder = async function (orderId) {
  if (!confirm("Decline this service order? Wallet payment will be refunded automatically.")) return;
  try {
    await apiPost("/api/decline-order", { orderId, reason: "Declined by admin" });
    alert("Service order declined.");
  } catch (error) {
    alert(error.message || "Decline failed.");
  }
};


window.processFreeFireAutoTopup = async function (orderId) {
  if (!confirm("Process this Free Fire order automatically through FazerCards?")) return;

  try {
    const result = await apiPost("/api/process-ff-topup", { orderId });
    alert("Auto top-up request sent. Provider order created.");

  } catch (error) {

    alert(error.message || "Auto top-up failed.");
  }
};

window.checkFreeFireAutoOrder = async function (orderId, providerOrderId = "") {
  try {
    const route = providerOrderId
      ? `/api/check-ff-order?providerOrderId=${encodeURIComponent(providerOrderId)}`
      : `/api/check-ff-order?orderId=${encodeURIComponent(orderId)}`;
    const result = await apiPost(route, {});
    alert("Order status: " + (result.status || "updated"));
  } catch (error) {

    alert(error.message || "Order status check failed.");
  }
};


// ── Browser Notification System ─────────────────────────────────
async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const perm = await Notification.requestPermission();
  return perm === "granted";
}

function sendOrderNotification(orderId, serviceName, status) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const title = status === "approved" || status === "accepted" || status === "confirmed" || status === "completed"
    ? "Order Completed"
    : status === "declined" || status === "failed" || status === "cancelled"
    ? "Order Update"
    : "Order Processing";
  const body = status === "approved" || status === "accepted" || status === "confirmed" || status === "completed"
    ? `${serviceName || "Your order"} has been completed successfully.`
    : status === "declined" || status === "failed"
    ? `${serviceName || "Your order"} could not be processed. Please contact support.`
    : status === "cancelled"
    ? `${serviceName || "Your order"} was cancelled.`
    : `${serviceName || "Your order"} is being processed. Please wait.`;
  try {
    const n = new Notification(title, {
      body,
      icon: "https://rabbihossainltd.online/favicon.ico",
      tag: `order-${orderId}`,
      requireInteraction: false
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 6000);
  } catch (e) { /* ignore */ }
}

const _notifiedOrders = {};
function trackOrderNotification(orderId, data) {
  const status = String(data?.status || "").toLowerCase();
  const prev = _notifiedOrders[orderId];
  if (!prev) { _notifiedOrders[orderId] = status; return; }
  if (prev !== status) {
    _notifiedOrders[orderId] = status;
    const finalStatuses = ["approved", "accepted", "confirmed", "completed", "declined", "failed", "cancelled"];
    if (finalStatuses.includes(status)) {
      sendOrderNotification(orderId, data?.serviceName || "Service", status);
    }
  }
}

const TOPUP_EXPIRE_MS = 30 * 60 * 1000;
const ORDER_EXPIRE_MS = 10 * 60 * 1000;
const _expireTried = {};

function isPendingStatus(status) {
  const v = String(status || '').toLowerCase();
  return v === 'pending' || v === 'paid_credit_pending_review' || v === 'paid_instant_pending_review';
}

function applyTimeoutStatus(item) {
  if (!item || !item.ts || !isPendingStatus(item.status)) return item;
  const age = Date.now() - item.ts;
  if (item.kind === 'topup' && String(item.data && item.data.purpose || '') !== 'service') {
    if (age >= TOPUP_EXPIRE_MS) item.status = 'expired';
  } else if (age >= ORDER_EXPIRE_MS) {
    item.status = 'expired';
  }
  return item;
}

async function expireStaleItems(list) {
  for (const item of list) {
    if (!item || !item.ts) continue;
    const original = String((item.data && item.data.status) || item.status || '').toLowerCase();
    if (!isPendingStatus(original)) continue;
    const age = Date.now() - item.ts;
    const key = item.kind + ':' + item.id;
    if (_expireTried[key]) continue;
    if (item.kind === 'topup' && String(item.data && item.data.purpose || '') !== 'service') {
      if (age < TOPUP_EXPIRE_MS) continue;
      _expireTried[key] = 1;
      try {
        await updateDoc(doc(db, 'topups', item.id), {
          status: 'expired',
          expiredAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          failReason: 'Expired after 30 minutes'
        });
      } catch (e) {
        try { await apiPost('/api/decline-topup', { topupId: item.id, reason: 'Expired after 30 minutes' }); } catch (e2) {}
      }
    } else {
      if (age < ORDER_EXPIRE_MS) continue;
      _expireTried[key] = 1;
      try {
        await apiPost('/api/decline-order', { orderId: item.id, reason: 'Auto-cancelled after 10 minutes' });
      } catch (e) {
        try { await apiPost('/api/expire-pending', { orderId: item.id }); } catch (e2) {}
      }
    }
  }
}

function loadOrdersUnified(user) {
  const root = document.getElementById("ordersRoot");
  if (!root) return;
  const searchInput = document.getElementById("ordersSearchInput");
  const filtersEl = document.getElementById("ordersFilters");

  let serviceOrders = [];
  let topups = [];
  let activeFilter = "all";
  let activeQuery = "";

  const svgCard = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`;
  const svgKey  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="7" cy="17" r="3"/><path d="M10.5 13.5 21 3"/><path d="M18 5l1 1"/><path d="M15 8l1 1"/></svg>`;
  const svgCal  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`;
  const svgInvoice = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>`;
  const svgCancel = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>`;
  const svgOk = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12.5 5 5L20 6.5"/></svg>`;
  const svgClock = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
  const svgX = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
  const svgBox = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>`;
  const svgGame = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7.4 9.25h9.2c2.25 0 4.15 1.72 4.35 3.96l.22 2.42a2.55 2.55 0 0 1-4.42 1.95l-1.38-1.48H8.63l-1.38 1.48a2.55 2.55 0 0 1-4.42-1.95l.22-2.42a4.37 4.37 0 0 1 4.35-3.96Z"/><path d="M8.25 12v3M6.75 13.5h3M15.75 13.25h.01M18.25 14.75h.01"/></svg>`;
  const svgApp = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`;
  const svgTag = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;

  function statusKey(status) {
    const sc = statusClass(status);
    if (["declined", "cancelled", "failed", "rejected", "expired"].includes(sc)) return "declined";
    return sc;
  }

  function statusIcon(sc) {
    if (sc === "approved") return svgOk;
    if (sc === "declined" || sc === "cancelled" || sc === "failed") return svgX;
    return svgClock;
  }

  function normalizeOrder(id, data) {
    const usdAmt = normalizeUsd(data.amountUsd || data.amountUSD || 0);
    return {
      id, kind: "order",
      name: data.serviceName || "Service",
      usd: usdAmt,
      bdt: Number.isFinite(Number(data.amountBdt)) && Number(data.amountBdt) > 0 ? Number(data.amountBdt) : toBdt(usdAmt),
      status: data.status || "pending",
      method: data.paymentMethod || data.method || "credit",
      tx: data.transactionId || "",
      ts: createdMillis(data),
      data
    };
  }

  function normalizeTopup(id, data) {
    const isService = data.purpose === "service";
    const usdAmt = normalizeUsd(data.amountUsd || data.amountUSD || data.amount || 0);
    return {
      id, kind: "topup",
      name: isService ? (data.serviceName || "Instant Service Payment") : "Credit Top-up",
      usd: usdAmt,
      bdt: Number.isFinite(Number(data.amountBdt)) && Number(data.amountBdt) > 0 ? Number(data.amountBdt) : toBdt(usdAmt),
      status: data.status || "pending",
      method: data.method || "Manual",
      tx: data.transactionId || "",
      ts: createdMillis(data),
      data
    };
  }

  function dateGroup(ts) {
    if (!ts) return "Earlier";
    const d = new Date(ts);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const day = 86400000;
    if (d.getTime() >= start) return "Today";
    if (d.getTime() >= start - day) return "Yesterday";
    if (d.getTime() >= start - 7 * day) return "This Week";
    if (d.getTime() >= start - 30 * day) return "This Month";
    return "Earlier";
  }

  function fmtDate(ts) {
    return ts ? new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
  }

  function cardHtml(i) {
    const sc = statusClass(i.status);
    const badge = `<span class="status-badge ${sc}">${statusIcon(sc)}${statusLabel(i.status)}</span>`;
    const money = `${usd(i.usd)} <span class="sep">/</span> ${bdt(i.bdt)}`;

    const details = getOrderDetails(i.data);
    const purchasedApp = (function () {
      if (details.app_name) return details.app_name;
      if (details.appName) return details.appName;
      const raw = details.source_page || i.data.source_page || "";
      const m = raw.match(/[?&]app=([^&]+)/);
      return m ? decodeURIComponent(m[1]).replace(/-/g, " ") : "";
    })();
    const ffUid = getFreeFireUid(i.data);
    const coupon = i.data.couponCode ? `${i.data.couponCode}${i.data.discountPercent ? ` (${i.data.discountPercent}% off)` : ""}` : "";
    const failReason = (sc === "declined" || sc === "failed") && i.data.failReason ? i.data.failReason : "";

    const meta = [
      `${svgCard}Method: <b>${escapeHtml(i.method)}</b>`,
      i.tx ? `${svgKey}TX: <b>${escapeHtml(i.tx)}</b>` : "",
      coupon ? `${svgTag}${escapeHtml(coupon)}` : "",
      ffUid ? `${svgGame}UID: <b>${escapeHtml(ffUid)}</b>` : "",
      purchasedApp ? `${svgApp}${escapeHtml(purchasedApp)}` : "",
      `${svgCal}${fmtDate(i.ts)}`
    ].filter(Boolean).map(t => `<span class="oc-meta-item">${t}</span>`).join("");

    const isIos = String(i.data.serviceName || "").toLowerCase().includes("iphone") ||
      String(i.data.serviceId || "").toLowerCase().includes("ffios") ||
      String(details.fieldsType || "").toLowerCase().includes("ffios");
    const deliveredKey = i.data.deliveredKey || details.deliveredKey || "";
    const safeKey = String(deliveredKey).replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
    const iosBlock = (isIos && deliveredKey) ? `
      <div class="oc-ios-key">
        <div class="k-head"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="7" cy="17" r="3"/><path d="M10.5 13.5 21 3"/><path d="M18 5l1 1M15 8l1 1"/></svg> Delivered Key</div>
        <div class="k-val">${escapeHtml(deliveredKey)}</div>
        <button type="button" class="k-copy" onclick="(function(b,k){navigator.clipboard.writeText(k).then(function(){var o=b.innerHTML;b.innerHTML='<svg width=\\'12\\' height=\\'12\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2.5\\' stroke-linecap=\\'round\\'><path d=\\'M20 6 9 17l-5-5\\'/></svg> Copied!';setTimeout(function(){b.innerHTML=o;},2000);});})(this,\`${safeKey}\`)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Key</button>
      </div>` : "";

    const pendingNote = (sc === "pending" || sc === "processing") ? `<div class="oc-pending-note">${svgClock} Orders are usually <strong>within 15 minutes</strong> to complete</div>` : "";
    const failBlock = failReason ? `<div class="oc-fail-reason">${svgX} Reason: ${escapeHtml(failReason)}</div>` : "";

    const canInvoice = sc === "approved";
    const canCancel = (i.kind === "order") ? canCancelOrder(i.status) : canCancelTopup(i.status);
    const actions = [];
    if (canInvoice) actions.push(`<button class="oc-btn" type="button" onclick="window.downloadInvoice(${JSON.stringify({ ...i.data, createdAt: null, updatedAt: null }).replace(/'/g, "&#39;")}, '${escapeHtml(i.id)}')">${svgInvoice}Invoice</button>`);
    if (canCancel && i.kind === "order") actions.push(`<button class="oc-btn danger" type="button" onclick="window.cancelServiceOrderRequest('${escapeHtml(i.id)}')">${svgCancel}Cancel</button>`);
    if (canCancel && i.kind === "topup") actions.push(`<button class="oc-btn danger" type="button" onclick="window.cancelTopupRequest('${escapeHtml(i.id)}')">${svgCancel}Cancel</button>`);
    const actionsHtml = actions.length ? `<div class="oc-actions">${actions.join("")}</div>` : "";

    return `
      <div class="order-card ${sc}">
        <div class="oc-top">
          <div>
            <div class="oc-name">${escapeHtml(i.name)}</div>
            <div class="oc-amount">${money}</div>
          </div>
          ${badge}
        </div>
        <div class="oc-meta">${meta}</div>
        ${iosBlock}
        ${pendingNote}
        ${failBlock}
        ${actionsHtml}
      </div>`;
  }

  function render() {
    const all = serviceOrders.concat(topups).map((i) => applyTimeoutStatus(i));
    let items = all.filter(i => activeFilter === "all" ? true : statusKey(i.status) === activeFilter);
    if (activeQuery) {
      const q = activeQuery.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || (i.tx && i.tx.toLowerCase().includes(q)) || (i.id && i.id.toLowerCase().includes(q)));
    }
    items.sort((a, b) => b.ts - a.ts);

    const counts = { all: all.length, pending: 0, processing: 0, approved: 0, declined: 0 };
    all.forEach(i => { const k = statusKey(i.status); if (counts[k] !== undefined) counts[k]++; });
    if (filtersEl) {
      filtersEl.querySelectorAll(".orders-filter-chip").forEach(chip => {
        const f = chip.dataset.filter;
        const c = chip.querySelector(".count");
        if (c) c.textContent = "(" + (counts[f] || 0) + ")";
      });
    }

    if (!items.length) {
      root.innerHTML = `<div class="orders-empty">${svgBox}<p>No orders found for this filter</p></div>`;
      return;
    }

    const groups = {};
    items.forEach(i => { const g = dateGroup(i.ts); (groups[g] = groups[g] || []).push(i); });
    root.innerHTML = Object.keys(groups).map(g => `
      <div class="order-date-group">
        <div class="order-date-label">${g}</div>
        <div class="order-list">${groups[g].map(cardHtml).join("")}</div>
      </div>`).join("");
  }

  if (searchInput && !searchInput._wired) {
    searchInput._wired = true;
    searchInput.addEventListener("input", () => { activeQuery = searchInput.value; render(); });
  }
  if (filtersEl && !filtersEl._wired) {
    filtersEl._wired = true;
    filtersEl.addEventListener("click", (e) => {
      const chip = e.target.closest(".orders-filter-chip");
      if (!chip) return;
      filtersEl.querySelectorAll(".orders-filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      activeFilter = chip.dataset.filter;
      render();
    });
  }

  function loadOrdersOnce() {
    try {
      onSnapshot(
        query(collection(db, "serviceOrders"), where("userId", "==", user.uid), limit(100)),
        (snap) => {
          const arr = [];
          snap.forEach(d => arr.push(normalizeOrder(d.id, d.data() || {})));
          arr.forEach(o => { applyTimeoutStatus(o); trackOrderNotification(o.id, o.data); });
          serviceOrders = arr;
          expireStaleItems(arr);
          render();
        },
        (err) => {
          console.warn("[Orders] serviceOrders snapshot error:", err && err.message ? err.message : err);
          serviceOrders = [];
          render();
        }
      );
    } catch (e) {
      serviceOrders = [];
      render();
    }
    try {
      onSnapshot(
        query(collection(db, "topups"), where("userId", "==", user.uid), limit(100)),
        (snap) => {
          const arr = [];
          snap.forEach(d => arr.push(applyTimeoutStatus(normalizeTopup(d.id, d.data() || {}))));
          topups = arr;
          expireStaleItems(arr);
          render();
        },
        (err) => {
          console.warn("[Orders] topups snapshot error:", err && err.message ? err.message : err);
          topups = [];
          render();
        }
      );
    } catch (e) {
      topups = [];
      render();
    }
  }

  loadOrdersOnce();
  // Paint empty state immediately instead of hanging on "Loading..." if snapshots are slow.
  render();
}

function setDashboardName(value) {
  const el = document.getElementById("dashboardName");
  if (!el) return;
  const badge = el.querySelector(".user-verify-badge");
  el.textContent = value;
  if (badge) el.appendChild(badge);
}

window.loadUserDashboard = function () {
  const applyDashboardUser = async (user) => {
    const loginRequired = document.getElementById("dashboardLoginRequired");
    const content = document.getElementById("dashboardContent");
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    const ordersOnly = tabParam === "orders";

    if (ordersOnly) {
      document.documentElement.classList.add("orders-only-mode");
    }

    if (!user) {
      if (hasCachedUser()) return;
      if (loginRequired) loginRequired.style.display = "block";
      if (content) content.style.display = "none";
      return;
    }

    currentUser = user;

    if (loginRequired) loginRequired.style.display = "none";
    if (content) content.style.display = "block";

    if (ordersOnly) {
      showDashboardTab("orders");
      loadOrdersUnified(user);
      requestNotificationPermission().catch(() => {});
      return;
    }

    let cached = {};
    try { cached = JSON.parse(localStorage.getItem('rh_user_cache') || '{}'); } catch(e) {}

    const cachedName    = cached.displayName || user.displayName || user.email || "User";
    const cachedEmail   = cached.email       || user.email || "";
    const cachedPhoto   = pickDashPhoto(null, user, cached);

    setDashboardName(cachedName);
    setText("dashboardEmail", cachedEmail);
    const dashBalEl = document.getElementById("dashboardBalance");
    if (dashBalEl && !dashBalEl.dataset.rhLive && cached.balance) {
      dashBalEl.textContent = cached.balance;
    }

    const quickAvatar = document.getElementById("dashboardAvatar");
    if (quickAvatar) {
      if (cachedPhoto) quickAvatar.innerHTML = `<img src="${escapeHtml(cachedPhoto)}" alt="Profile photo">`;
      else quickAvatar.textContent = String(cachedName).charAt(0).toUpperCase();
    }

    ensureUserDoc(user).catch(() => {});
    listenUserCredit(user);

    const userRef = doc(db, "users", user.uid);
    onSnapshot(userRef, (snap) => {
      const data = snap.exists() ? snap.data() : {};
      setDashboardName(data.name || user.displayName || "User");
      setText("dashboardEmail", data.email || user.email || "");
      const liveBal = document.getElementById("dashboardBalance");
      if (liveBal && data.credit !== undefined && data.credit !== null) {
        liveBal.dataset.rhLive = '1';
        delete liveBal.dataset.rhStale;
        setText("dashboardBalance", moneyPair(data.credit || 0));
      }
      const avatar = document.getElementById("dashboardAvatar");
      const livePhoto = pickDashPhoto(data, user, cached);
      if (avatar) {
        const shownImg = avatar.querySelector("img");
        const shown = shownImg ? (shownImg.getAttribute("src") || "") : "";
        let paint = livePhoto;
        if (paint && isAuthDefaultPhoto(paint) && shown && !isAuthDefaultPhoto(shown)) paint = shown;
        if (paint) {
          if (shownImg) {
            if (shownImg.getAttribute("src") !== paint) shownImg.src = paint;
          } else {
            avatar.innerHTML = `<img src="${escapeHtml(paint)}" alt="Profile photo">`;
          }
        } else {
          avatar.textContent = String(data.name || user.displayName || user.email || "U").charAt(0).toUpperCase();
        }
      }
      try {
        const next = JSON.parse(localStorage.getItem('rh_user_cache') || '{}');
        if (data.credit !== undefined && data.credit !== null) {
          next.balance = moneyPair(data.credit || 0);
          next.credit_raw = data.credit || 0;
        }
        next.displayName = data.name || user.displayName || next.displayName || '';
        next.email = data.email || user.email || next.email || '';
        next.photoURL = livePhoto || next.photoURL || '';
        next.uid = user.uid;
        next.cache_ts = Date.now();
        localStorage.setItem('rh_user_cache', JSON.stringify(next));
      } catch(e) {}
    });

    const orderPanel2 = document.querySelector('[data-dashboard-panel="orders"]');
    if (orderPanel2) orderPanel2.style.display = "none";
  };

  (async () => {
    try {
      if (typeof auth.authStateReady === "function") await auth.authStateReady();
    } catch (e) {}
    applyDashboardUser(auth.currentUser);
  })();

  onAuthStateChanged(auth, applyDashboardUser);
};

function setupDashboardTabs() {
  const tabParam = new URLSearchParams(window.location.search).get("tab");
  const defaultTab = tabParam === "orders" ? "orders" : "payments";
  document.querySelectorAll("[data-dashboard-tab]").forEach((btn) => {
    btn.addEventListener("click", () => showDashboardTab(btn.dataset.dashboardTab));
  });
  showDashboardTab(defaultTab);
}

window.showDashboardTab = showDashboardTab;
function showDashboardTab(tab) {
  document.querySelectorAll("[data-dashboard-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.dashboardTab === tab);
  });
  document.querySelectorAll("[data-dashboard-panel]").forEach((panel) => {
    panel.style.display = panel.dataset.dashboardPanel === tab ? "block" : "none";
  });
}

function canCancelTopup(status) {
  return String(status || "").toLowerCase() === "pending";
}

function canCancelOrder(status) {
  const value = String(status || "").toLowerCase();
  return value === "paid_instant_pending_review" || value === "pending";
}


window.cancelTopupRequest = async function (topupId) {
  if (!currentUser) return;
  if (!confirm("Cancel this pending payment request?")) return;

  try {
    await updateDoc(doc(db, "topups", topupId), {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    alert(error.message || "Unable to cancel request.");
  }
};

window.cancelServiceOrderRequest = async function (orderId) {
  if (!currentUser) return;
  if (!confirm("Cancel this pending service order? Wallet credit will be refunded.")) return;

  try {
    await apiPost("/api/decline-order", { orderId, reason: "Cancelled by user" });
  } catch (error) {
    alert(error.message || "Unable to cancel order.");
  }
};

/* ==========================================================================
 *  SPV AUTO-PAYMENT (frontend) — https://spv-services.web.app
 *  The SPV API key lives on YOUR Render backend; the browser only ever talks
 *  to your own backend, which talks to SPV. See spv-integration/backend/.
 * ========================================================================== */

const SPV_PENDING_KEY = "spvPendingIntent";
const SPV_POLL_INTERVAL_MS = 4000;   // poll backend every 4s
const SPV_POLL_MAX_MS = 6 * 60 * 1000; // give up to 6 min of active polling

// Direct fetch to your own backend (bypasses backendRoute's path-encoding so it
// matches the standard Express mount: app.use('/api/payment/spv', spvRoutes)).
async function spvApiFetch(path, { method = "GET", body } = {}) {
  const user = await waitForActiveUser(8000);
  if (!user) {
    const err = new Error("NOT_LOGGED_IN");
    err.code = "NOT_LOGGED_IN";
    throw err;
  }
  let token;
  try { token = await user.getIdToken(true); }
  catch (e) { const err = new Error("SESSION_EXPIRED"); err.code = "AUTH_REFRESH_FAILED"; throw err; }
  const res = await fetch(BACKEND_API_BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); }
  catch (e) { data = { ok: false, message: "Invalid backend response." }; }
  if (!res.ok || !data.ok) {
    const err = new Error(data?.message || data?.error || ("Request failed (" + res.status + ")"));
    err.code = data?.error || "BACKEND_ERROR";
    err.response = data;
    throw err;
  }
  return data;
}

function spvMsg(text, type = "info") {
  const el = document.getElementById("spvAutoMsg");
  if (!el) return;
  el.textContent = text;
  el.className = "spv-auto-msg " + type;
  el.style.display = "block";
}
function spvMsgClear() {
  const el = document.getElementById("spvAutoMsg");
  if (el) { el.textContent = ""; el.className = "spv-auto-msg"; el.style.display = "none"; }
}

function saveSpvPending(intent) {
  try { sessionStorage.setItem(SPV_PENDING_KEY, JSON.stringify({ ...intent, ts: Date.now() })); } catch (e) {}
}
function loadSpvPending() {
  try {
    const raw = sessionStorage.getItem(SPV_PENDING_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Expire after 35 min (SPV checkout window is 30 min).
    if (!data || !data.topupId || Date.now() - (data.ts || 0) > 35 * 60 * 1000) {
      sessionStorage.removeItem(SPV_PENDING_KEY);
      return null;
    }
    return data;
  } catch (e) { return null; }
}
function clearSpvPending() {
  try { sessionStorage.removeItem(SPV_PENDING_KEY); } catch (e) {}
}

let _spvPollTimer = null;
function spvStopPolling() {
  if (_spvPollTimer) { clearInterval(_spvPollTimer); _spvPollTimer = null; }
}

// Drives the backend to poll SPV. When SPV verifies, the backend credits the
// user + flips the topup doc to 'approved'; the verifying overlay's Firestore
// listener then shows the green tick. We also handle late approvals here.
function spvToast(msg) {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:rgba(255, 255, 255,.95);color:#10100f;font-weight:800;font-size:.9rem;padding:12px 18px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.4);z-index:99999;animation:fadeUp .3s ease both;max-width:90vw;text-align:center;";
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = "opacity .4s"; t.style.opacity = "0"; setTimeout(() => t.remove(), 450); }, 3500);
}

// Success screen + redirect — used when the customer returns to our site after
// SPV has verified the payment. Reuses the green-tick screen from add-credit.html
// (showApprovedTick), which then redirects to dashboard.html.
function spvApprovedReturn() {
  const old = document.getElementById("verifyOverlay");
  if (old) old.remove();
  if (typeof window.showApprovedTick === "function") {
    const ov = document.createElement("div");
    ov.className = "verify-overlay";
    ov.id = "verifyOverlay";
    document.body.appendChild(ov);
    window.showApprovedTick(ov); // shows tick, then redirects to dashboard.html
  } else {
    location.href = "/dashboard/?tab=payments&spv=approved";
  }
}

// Return-poller: checks the top-up once immediately (the common case — the
// customer comes back after it's already verified), then keeps polling for the
// fast-return case where verification is still in progress. Never blocks the UI.
function spvStartPolling(topupId) {
  spvStopPolling();

  const check = async () => {
    try {
      const data = await spvApiFetch("/api/payment/spv/status?topupId=" + encodeURIComponent(topupId));
      const status = String(data.topupStatus || "").toLowerCase();
      if (status === "approved" || status === "completed") {
        spvStopPolling();
        clearSpvPending();
        spvApprovedReturn();
      } else if (["declined", "rejected", "cancelled", "expired"].includes(status)) {
        spvStopPolling();
        clearSpvPending();
        spvToast("Payment not verified. Please try again.");
      }
    } catch (e) {
      // transient — keep polling
    }
  };

  check();
  const started = Date.now();
  _spvPollTimer = setInterval(() => {
    if (Date.now() - started > SPV_POLL_MAX_MS) { spvStopPolling(); return; }
    check();
  }, SPV_POLL_INTERVAL_MS);
}

// Main entry — wired to the "Auto Payment" button in add-credit.html.
window.startSpvAutoPayment = async function () {
  spvMsgClear();

  const amountUsd = Number(window._currentSelectedUsd ? window._currentSelectedUsd() : 0) || 0;
  if (!amountUsd || amountUsd < 1) {
    spvMsg("Enter at least $1, then press Auto Payment.", "error");
    showStep && showStep(1);
    return;
  }

  // Login check.
  const user = await waitForActiveUser(8000);
  if (!user) {
    spvMsg("Login first, then use Auto Payment.", "error");
    if (typeof openLoginOrHome === "function") openLoginOrHome();
    return;
  }

  // Show progress on the button itself (no extra message line below).
  const _payBtn = document.getElementById("spvPayBtn");
  const _payLbl = document.getElementById("spvPayBtnLabel");
  const _payOld = _payLbl ? _payLbl.textContent : "";
  if (_payBtn) _payBtn.disabled = true;
  if (_payLbl) _payLbl.textContent = "Creating payment link…";
  const _payReset = function () {
    if (_payBtn) _payBtn.disabled = false;
    if (_payLbl) _payLbl.textContent = _payOld || "Continue to Payment";
  };
  spvMsgClear();

  try {
    const data = await spvApiFetch("/api/payment/spv/create-intent", {
      method: "POST",
      body: { amountUsd }
    });

    if (!data.checkoutUrl) throw new Error("Checkout link not found.");

    saveSpvPending({ topupId: data.topupId, paymentId: data.paymentId, amountUsd });

    // Follow SPV's intended pattern: send the customer to SPV's hosted checkout
    // in the SAME tab (SPV shows its own payment + verification UI + receipt).
    // When the customer returns to our site, spvResumeIfPending() detects the
    // verified intent and redirects them to the dashboard (success).
    spvMsgClear();
    window.location.href = data.checkoutUrl;
  } catch (err) {
    _payReset();
    if (err.code === "NOT_LOGGED_IN" || err.code === "AUTH_REFRESH_FAILED") {
      spvMsg("Login session expired — please sign in again.", "error");
      if (typeof openLoginOrHome === "function") openLoginOrHome();
    } else if (err.code === "SPV_NOT_CONFIGURED") {
      spvMsg("Auto Payment is not available yet. Try again later.", "error");
    } else {
      // Friendly message in UI (raw server errors like Firestore UNAUTHENTICATED
      // are logged to console for debugging, not shown to the user).
      spvMsg("Could not start payment. Please try again later.", "error");
      console.error("[SPV] start error:", err && err.message ? err.message : err);
    }
  }
};

// Resume an in-flight SPV payment if the user returns to this page.
// Read our embedded top-up id from the URL hash when SPV redirects the customer
// back via returnUrl. Tolerates any query/params SPV may append, e.g.
// "...add-credit.html#t=ID?status=verified" or "...?status=verified#t=ID".
function getReturnTopupId() {
  const fromHash = (() => {
    const h = (location.hash || "").replace(/^#/, "");
    const seg = (h.split(/[?&]/)[0] || "").trim();
    const m = seg.match(/^t=(.+)$/);
    return m ? decodeURIComponent(m[1]) : "";
  })();
  if (fromHash) return fromHash;
  try {
    const q = new URLSearchParams(location.search);
    return q.get("t") || q.get("topup") || q.get("topupId") || "";
  } catch (e) { return ""; }
}

function spvResumeIfPending() {
  if (!document.getElementById("walletContent")) return;

  // 1) Returned via SPV returnUrl (hash carries the top-up id)?
  let topupId = getReturnTopupId();
  if (topupId) {
    saveSpvPending({ topupId }); // keep the poller/consistency happy
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} // clean URL
  } else {
    // 2) Otherwise fall back to the intent saved before we left for SPV.
    const pending = loadSpvPending();
    topupId = pending ? pending.topupId : "";
  }
  if (!topupId) return;

  // If verified -> success screen + redirect to dashboard; if still pending ->
  // poll quietly (no blocking overlay) until it resolves.
  spvStartPolling(topupId);
}
// showApprovedTick (used on approved return) is defined by the page's inline
// script, which runs before this module — a short delay is just a safety margin.
setTimeout(spvResumeIfPending, 500);


