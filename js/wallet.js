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
  runTransaction,
  increment
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const USD_TO_BDT = 125;

const PAYMENT_NUMBERS = {
  bKash: "01731410341",
  Nagad: "01731410341",
  Rocket: "01731410341"
};

const ADMIN_EMAILS = ["rabbihossainltd@gmail.com"];
const BACKEND_API_BASE = "https://rabbi-backend-vlr7.onrender.com";

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
  if (["approved", "accepted", "confirmed", "completed", "processing", "delivered", "paid_credit_pending_review", "paid_instant_pending_review"].includes(value)) return value;
  if (["declined", "cancelled", "rejected", "failed"].includes(value)) return value;
  return "pending";
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
  return `<button class="confirm" style="grid-column:1/-1;background:linear-gradient(135deg,#f7b733,#00ff88);color:#02050a;" onclick="processFreeFireAutoTopup('${orderId}')">Process Auto Top-up</button>`;
}

function adminOrderDetailsHtml(data) {
  const details = getOrderDetails(data);
  const ffUid = getFreeFireUid(data);
  const productId = getFreeFireProductId(data);
  const providerOrderId = data?.providerOrderId || data?.fazercardsOrderId || "";
  return `
    ${ffUid ? `<p><b>Free Fire UID:</b> ${escapeHtml(ffUid)}</p>` : ""}
    ${productId ? `<p><b>FazerCards Product ID:</b> ${escapeHtml(productId)}</p>` : ""}
    ${providerOrderId ? `<p><b>Provider Order ID:</b> ${escapeHtml(providerOrderId)}</p>` : ""}
    <div class="admin-details"><b>Order Details:</b><pre>${escapeHtml(JSON.stringify(details, null, 2))}</pre></div>
  `;
}


function openLoginOrHome() {
  if (window.rabbiAuth && typeof window.rabbiAuth.openLogin === "function") {
    window.rabbiAuth.openLogin();
  } else {
    window.location.href = "index.html";
  }
}

async function waitForActiveUser(timeoutMs = 3500) {
  if (auth.currentUser) return auth.currentUser;
  if (window.rabbiAuth && typeof window.rabbiAuth.getUser === "function" && window.rabbiAuth.getUser()) {
    return window.rabbiAuth.getUser();
  }

  return await new Promise((resolve) => {
    let settled = false;
    let unsubscribe = null;
    const finish = (user) => {
      if (settled) return;
      settled = true;
      if (unsubscribe) unsubscribe();
      resolve(user || null);
    };

    unsubscribe = onAuthStateChanged(auth, (user) => finish(user));

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
    setText("walletPageSub", "Service payment manually পাঠান। Payment verify হলে service request active হবে।");
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

window.loadWalletPage = function () {
  setupPageMode();
  window.updatePaymentNumber();
  window.handleAmountChange();

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;

    const authRequired = document.getElementById("authRequired");
    const walletContent = document.getElementById("walletContent");

    if (!user) {
      if (authRequired) authRequired.style.display = "block";
      if (walletContent) walletContent.style.display = "none";
      return;
    }

    if (authRequired) authRequired.style.display = "none";
    if (walletContent) walletContent.style.display = "grid";

    await ensureUserDoc(user);
    listenUserCredit(user);
    setText("userEmail", user.email || "No email");
    setText("userName", user.displayName || user.email || "User");
    window.loadMyTopups();
  });
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

window.submitTopup = async function () {
  const user = await waitForActiveUser();
  if (!user) {
    showMessage("আগে Login করো, তারপর payment request submit হবে।", "error");
    openLoginOrHome();
    return;
  }
  currentUser = user;

  const method = document.getElementById("paymentMethod")?.value;
  const transactionId = document.getElementById("transactionId")?.value.trim();
  const amountUsd = normalizeUsd(getSelectedUsdAmount());
  const amountBdt = toBdt(amountUsd);

  if (!method) {
    showMessage("Payment method select করো।", "error");
    return;
  }

  if (!amountUsd || amountUsd < 1) {
    showMessage("Minimum $1 amount দিতে হবে।", "error");
    return;
  }

  if (!transactionId || transactionId.length < 5) {
    showMessage("Valid Transaction ID দাও।", "error");
    return;
  }

  const submitBtn = document.getElementById("submitTopupBtn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
  }

  try {
    await ensureUserDoc(user);

    if (pageMode === "service") {
      const details = servicePaymentInfo?.details || {};
      await apiPost("/api/instant-pay", {
        serviceName: servicePaymentInfo?.serviceName || "Service",
        serviceId: servicePaymentInfo?.fieldsType || servicePaymentInfo?.serviceId || "service",
        amountUsd,
        method,
        transactionId,
        serviceDetails: details
      });

      sessionStorage.removeItem("pendingServicePayment");
      showMessage("Service payment request submitted. Admin review pending.", "success");
      const tx = document.getElementById("transactionId");
      if (tx) tx.value = "";
      setTimeout(() => {
        window.location.href = "dashboard.html?tab=orders";
      }, 900);
      return;
    }

    const payload = {
      userId: user.uid,
      userName: user.displayName || "User",
      userEmail: user.email || "",
      purpose: "credit",
      serviceName: "",
      serviceDetails: {},
      amountUsd,
      amountUSD: amountUsd,
      amountBdt,
      amountBDT: amountBdt,
      rate: USD_TO_BDT,
      rateBDT: USD_TO_BDT,
      method,
      paymentNumber: PAYMENT_NUMBERS[method] || "",
      transactionId,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await addDoc(collection(db, "topups"), payload);
    showMessage("Credit request submitted. Admin approval pending.", "success");

    const tx = document.getElementById("transactionId");
    if (tx) tx.value = "";
  } catch (error) {
    console.error("submitTopup failed:", error);
    if (error.code === "NOT_LOGGED_IN") {
      showMessage("Please login first.", "error");
      openLoginOrHome();
    } else {
      showMessage(error.message || "Payment request failed.", "error");
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = pageMode === "service" ? "Verify Service Payment" : "Verify Payment";
    }
  }
};

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

    console.log("[buyServiceWithCredit] Backend order complete:", result);
    return {
      ok: true,
      orderId: result.orderId,
      amountUsd,
      amountBdt: toBdt(amountUsd),
      newCredit: result.newCredit
    };
  } catch (error) {
    console.error("[buyServiceWithCredit] Backend failed:", error);
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
  onAuthStateChanged(auth, async (user) => {
    const topupList = document.getElementById("adminTopupList");
    const orderList = document.getElementById("adminOrderList");
    const topupHistoryList = document.getElementById("adminTopupHistoryList");
    const orderHistoryList = document.getElementById("adminOrderHistoryList");
    const adminInfo = document.getElementById("adminInfo");

    if (!user) {
      if (topupList) topupList.innerHTML = `<div class="empty-state">Please login with admin account first.</div>`;
      if (orderList) orderList.innerHTML = `<div class="empty-state">Please login with admin account first.</div>`;
      if (topupHistoryList) topupHistoryList.innerHTML = `<div class="empty-state">Please login with admin account first.</div>`;
      if (orderHistoryList) orderHistoryList.innerHTML = `<div class="empty-state">Please login with admin account first.</div>`;
      return;
    }

    const adminRef = doc(db, "admins", user.uid);
    const adminSnap = await getDoc(adminRef);
    const emailIsAdmin = ADMIN_EMAILS.includes(String(user.email || "").toLowerCase());

    if (!adminSnap.exists() && !emailIsAdmin) {
      document.body.innerHTML = `
        <main class="admin-denied">
          <div>
            <h1>Access Denied</h1>
            <p>This page is only for admin.</p>
            <a href="index.html">Go Back</a>
          </div>
        </main>
      `;
      return;
    }

    if (adminInfo) adminInfo.textContent = `Logged in as ${user.email || "Admin"}`;

    const topupQuery = query(collection(db, "topups"), where("status", "==", "pending"));
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
              <span class="status pending">pending</span>
            </div>
            <p><b>Purpose:</b> ${escapeHtml(purpose)}${data.serviceName ? " — " + escapeHtml(data.serviceName) : ""}</p>
            <p><b>User:</b> ${escapeHtml(data.userName || "User")}</p>
            <p><b>Email:</b> ${escapeHtml(data.userEmail || "No email")}</p>
            <p><b>Method:</b> ${escapeHtml(data.method || "Manual")}</p>
            <p><b>Number:</b> ${escapeHtml(data.paymentNumber || "")}</p>
            <p><b>Transaction ID:</b> ${escapeHtml(data.transactionId || "")}</p>
            ${purpose === "service" ? `<div class="admin-details"><b>Service Details:</b><pre>${escapeHtml(JSON.stringify(details, null, 2))}</pre></div>` : ""}
            <div class="actions">
              <button class="confirm" onclick="approveTopup('${docSnap.id}')">Confirm Payment</button>
              <button class="decline" onclick="declineTopup('${docSnap.id}')">Decline Payment</button>
            </div>
          </div>
        `;
      });
    });

    const orderQuery = query(collection(db, "serviceOrders"));
    onSnapshot(orderQuery, (snapshot) => {
      if (!orderList) return;
      orderList.innerHTML = "";

      const pendingDocs = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        if (isActionableOrder(data.status)) pendingDocs.push(docSnap);
      });
      pendingDocs.sort((a, b) => createdMillis(b.data()) - createdMillis(a.data()));

      if (!pendingDocs.length) {
        orderList.innerHTML = `<div class="empty-state">No pending service order.</div>`;
        return;
      }

      pendingDocs.forEach((docSnap) => {
        const data = docSnap.data() || {};
        orderList.innerHTML += `
          <div class="admin-card">
            <div class="admin-card-head">
              <h3>${escapeHtml(data.serviceName || "Service")}</h3>
              <span class="status ${statusClass(data.status)}">${escapeHtml(data.status || "pending")}</span>
            </div>
            <p><b>Amount:</b> ${moneyPair(data.amountUsd || data.amountUSD, data.amountBdt || data.amountBDT)}</p>
            <p><b>Payment:</b> ${escapeHtml(data.paymentMethod || "credit")}</p>
            <p><b>User:</b> ${escapeHtml(data.userName || "User")}</p>
            <p><b>Email:</b> ${escapeHtml(data.userEmail || "No email")}</p>
            ${data.transactionId ? `<p><b>Transaction ID:</b> ${escapeHtml(data.transactionId)}</p>` : ""}
            ${adminOrderDetailsHtml(data)}
            <div class="actions">
              <button class="confirm" onclick="approveServiceOrder('${docSnap.id}')">Accept Order</button>
              <button class="decline" onclick="declineServiceOrder('${docSnap.id}')">Decline Order</button>
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
              <span class="status ${statusClass(data.status)}">${escapeHtml(data.status || "pending")}</span>
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
              <span class="status ${statusClass(data.status)}">${escapeHtml(data.status || "pending")}</span>
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
  });
};

window.approveTopup = async function (topupId) {
  if (!confirm("Confirm this payment?")) return;

  try {
    await apiPost("/api/confirm-topup", { topupId });
    alert("Payment confirmed successfully.");
  } catch (error) {
    console.error("confirm topup failed:", error);
    alert(error.message || "Payment confirm failed.");
  }
};

window.declineTopup = async function (topupId) {
  if (!confirm("Decline this payment request?")) return;

  try {
    await apiPost("/api/decline-topup", { topupId });
    alert("Payment request declined.");
  } catch (error) {
    console.error("decline topup failed:", error);
    alert(error.message || "Payment decline failed.");
  }
};

window.approveServiceOrder = async function (orderId) {
  if (!confirm("Accept this service order?")) return;

  try {
    await apiPost("/api/confirm-order", { orderId });
    alert("Service order accepted. It has been moved to history.");
  } catch (error) {
    console.error("confirm order failed:", error);
    alert(error.message || "Service order confirm failed.");
  }
};

window.declineServiceOrder = async function (orderId) {
  if (!confirm("Decline this service order?")) return;

  try {
    await apiPost("/api/decline-order", { orderId });
    alert("Service order declined. It has been moved to history.");
  } catch (error) {
    console.error("decline order failed:", error);
    alert(error.message || "Service order decline failed.");
  }
};


window.processFreeFireAutoTopup = async function (orderId) {
  if (!confirm("Process this Free Fire order automatically through FazerCards?")) return;

  try {
    const result = await apiPost("/api/process-ff-topup", { orderId });
    alert("Auto top-up request sent. Provider order created.");
    console.log("FazerCards top-up result:", result);
  } catch (error) {
    console.error("process auto topup failed:", error);
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
    console.error("check auto topup failed:", error);
    alert(error.message || "Order status check failed.");
  }
};


function setupOrderViewTabs() {
  const buttons = document.querySelectorAll("[data-order-view]");
  const servicesPanel = document.getElementById("servicesOrderPanel");
  const transactionsPanel = document.getElementById("transactionsOrderPanel");
  if (!buttons.length || !servicesPanel || !transactionsPanel) return;

  const setView = (view) => {
    buttons.forEach((btn) => btn.classList.toggle("active", btn.dataset.orderView === view));
    servicesPanel.classList.toggle("active", view === "services");
    transactionsPanel.classList.toggle("active", view === "transactions");
  };

  buttons.forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => setView(btn.dataset.orderView));
  });

  setView("services");
}

window.loadUserDashboard = function () {
  onAuthStateChanged(auth, async (user) => {
    const loginRequired = document.getElementById("dashboardLoginRequired");
    const content = document.getElementById("dashboardContent");
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    const ordersOnly = tabParam === "orders";

    if (ordersOnly) {
      document.documentElement.classList.add("orders-only-mode");
    }

    if (!user) {
      if (loginRequired) loginRequired.style.display = "block";
      if (content) content.style.display = "none";
      return;
    }

    currentUser = user;

    if (loginRequired) loginRequired.style.display = "none";
    if (content) content.style.display = "block";

    if (ordersOnly) {
      // My Orders should load fast: do not load profile photo/name or balance here.
      showDashboardTab("orders");
      setupOrderViewTabs();
      loadDashboardOrders(user);
      loadDashboardTopups(user);
      return;
    }

    // Fast first paint: show auth profile immediately, then sync Firestore data.
    setText("dashboardName", user.displayName || user.email || "User");
    setText("dashboardEmail", user.email || "");
    const quickAvatar = document.getElementById("dashboardAvatar");
    if (quickAvatar) {
      if (user.photoURL) quickAvatar.innerHTML = `<img src="${escapeHtml(user.photoURL)}" alt="Profile photo">`;
      else quickAvatar.textContent = String(user.displayName || user.email || "U").charAt(0).toUpperCase();
    }

    ensureUserDoc(user).catch((err) => console.warn("ensureUserDoc failed", err));
    listenUserCredit(user);

    const userRef = doc(db, "users", user.uid);
    onSnapshot(userRef, (snap) => {
      const data = snap.exists() ? snap.data() : {};
      setText("dashboardName", data.name || user.displayName || "User");
      setText("dashboardEmail", data.email || user.email || "");
      setText("dashboardBalance", moneyPair(data.credit || 0));
      const avatar = document.getElementById("dashboardAvatar");
      if (avatar) {
        if (data.photoURL || user.photoURL) {
          avatar.innerHTML = `<img src="${escapeHtml(data.photoURL || user.photoURL)}" alt="Profile photo">`;
        } else {
          avatar.textContent = String(data.name || user.displayName || user.email || "U").charAt(0).toUpperCase();
        }
      }
    });

    // Profile page must stay clean; histories are available only from My Orders.
    const orderPanel2 = document.querySelector('[data-dashboard-panel="orders"]');
    if (orderPanel2) orderPanel2.style.display = "none";
  });
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

function loadDashboardTopups(user) {
  const list = document.getElementById("dashboardPaymentHistory");
  if (!list) return;

  const q = query(collection(db, "topups"), where("userId", "==", user.uid));
  onSnapshot(q, (snapshot) => {
    list.innerHTML = "";
    if (snapshot.empty) {
      list.innerHTML = `<div class="empty-state">No payment request found.</div>`;
      return;
    }

    const docs = [];
    snapshot.forEach((docSnap) => docs.push(docSnap));
    docs.sort((a, b) => {
      const da = a.data() || {};
      const dbb = b.data() || {};
      const ta = da.createdAt?.toMillis ? da.createdAt.toMillis() : (da.createdAt?.seconds || 0) * 1000;
      const tb = dbb.createdAt?.toMillis ? dbb.createdAt.toMillis() : (dbb.createdAt?.seconds || 0) * 1000;
      return tb - ta;
    });

    docs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      list.innerHTML += `
        <div class="dashboard-history-card">
          <div class="dashboard-history-head">
            <div>
              <strong>${escapeHtml(data.purpose === "service" ? (data.serviceName || "Instant Service Payment") : "Credit Top-up")}</strong>
              <span>${moneyPair(data.amountUsd || data.amountUSD || data.amount || 0, data.amountBdt || data.amountBDT)}</span>
            </div>
            <span class="status ${escapeHtml(data.status || "pending")}">${escapeHtml(data.status || "pending")}</span>
          </div>
          <p>Method: ${escapeHtml(data.method || "Manual")} ${data.transactionId ? "• TX: " + escapeHtml(data.transactionId) : ""}</p>
          ${canCancelTopup(data.status) ? `<button class="dashboard-cancel-btn" onclick="cancelTopupRequest('${docSnap.id}')">Cancel Pending Request</button>` : ""}
        </div>
      `;
    });
  });
}

function loadDashboardOrders(user) {
  const list = document.getElementById("dashboardOrderHistory");
  if (!list) return;

  const q = query(collection(db, "serviceOrders"), where("userId", "==", user.uid));
  onSnapshot(q, (snapshot) => {
    list.innerHTML = "";
    if (snapshot.empty) {
      list.innerHTML = `<div class="empty-state">No service order found.</div>`;
      return;
    }

    const docs = [];
    snapshot.forEach((docSnap) => docs.push(docSnap));
    docs.sort((a, b) => {
      const da = a.data() || {};
      const dbb = b.data() || {};
      const ta = da.createdAt?.toMillis ? da.createdAt.toMillis() : (da.createdAt?.seconds || 0) * 1000;
      const tb = dbb.createdAt?.toMillis ? dbb.createdAt.toMillis() : (dbb.createdAt?.seconds || 0) * 1000;
      return tb - ta;
    });

    docs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      list.innerHTML += `
        <div class="dashboard-history-card">
          <div class="dashboard-history-head">
            <div>
              <strong>${escapeHtml(data.serviceName || "Service")}</strong>
              <span>${moneyPair(data.amountUsd || data.amountUSD || 0, data.amountBdt || data.amountBDT)}</span>
            </div>
            <span class="status ${escapeHtml(data.status || "pending")}">${escapeHtml(data.status || "pending")}</span>
          </div>
          <p>${escapeHtml(data.paymentMethod || "credit")}${getFreeFireUid(data) ? " • UID: " + escapeHtml(getFreeFireUid(data)) : ""}${data.providerOrderId ? " • Auto ID: " + escapeHtml(data.providerOrderId) : ""}</p>
          ${canCancelOrder(data.status) ? `<button class="dashboard-cancel-btn" onclick="cancelServiceOrderRequest('${docSnap.id}')">Cancel Pending Request</button>` : ""}
        </div>
      `;
    });
  });
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
  if (!confirm("Cancel this pending service order?")) return;

  try {
    await updateDoc(doc(db, "serviceOrders", orderId), {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    alert(error.message || "Unable to cancel order.");
  }
};

