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


let currentUser = null;
let currentUserData = null;
let pageMode = "credit";
let servicePaymentInfo = null;

function usd(value) {
  return `$${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function bdt(value) {
  return `${Number(value || 0).toLocaleString("en-BD", { maximumFractionDigits: 0 })} BDT`;
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

function openLoginOrHome() {
  if (window.rabbiAuth && typeof window.rabbiAuth.openLogin === "function") {
    window.rabbiAuth.openLogin();
  } else {
    window.location.href = "index.html";
  }
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
    setText("userCredit", usd(data.credit));
    setText("miniCredit", usd(data.credit));
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
    setText("walletPageSub", "Service payment manually পাঠান। Admin confirm করলে service request active হবে।");
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
  if (!currentUser) {
    showMessage("আগে Login করো, তারপর payment request submit হবে।", "error");
    openLoginOrHome();
    return;
  }

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
    await ensureUserDoc(currentUser);

    const payload = {
      userId: currentUser.uid,
      userName: currentUser.displayName || "User",
      userEmail: currentUser.email || "",
      purpose: pageMode,
      serviceName: pageMode === "service" ? (servicePaymentInfo?.serviceName || "Service") : "",
      serviceDetails: pageMode === "service" ? (servicePaymentInfo?.details || {}) : {},
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
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, "topups"), payload);

    if (pageMode === "service") {
      sessionStorage.removeItem("pendingServicePayment");
      showMessage("Service payment request submitted. Admin approval pending.", "success");
    } else {
      showMessage("Credit request submitted. Admin approval pending.", "success");
    }

    const tx = document.getElementById("transactionId");
    if (tx) tx.value = "";
  } catch (error) {
    showMessage(error.message, "error");
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
            <strong>${usd(data.amountUsd || data.amountUSD || data.amount || 0)} / ${bdt(data.amountBdt || data.amountBDT || toBdt(data.amountUsd || data.amountUSD || 0))}</strong>
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
  const user = auth.currentUser;
  if (!user) {
    return { ok: false, reason: "login", message: "Please login first." };
  }

  const amountUsd = normalizeUsd(servicePayload?.amountUsd || servicePayload?.amountUSD || servicePayload?._amount_usd || 0);
  if (!amountUsd || amountUsd < 0.1) {
    return { ok: false, reason: "amount", message: "Valid service amount required." };
  }

  const userRef = doc(db, "users", user.uid);
  const orderRef = doc(collection(db, "serviceOrders"));

  try {
    await ensureUserDoc(user);

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("User account not found.");

      const userData = userSnap.data() || {};
      const currentCredit = normalizeUsd(userData.credit || 0);

      if (currentCredit + 0.0001 < amountUsd) {
        throw new Error(`INSUFFICIENT_CREDIT:${currentCredit}`);
      }

      const newCredit = normalizeUsd(currentCredit - amountUsd);
      const amountBdt = toBdt(amountUsd);

      transaction.update(userRef, {
        credit: newCredit,
        updatedAt: serverTimestamp()
      });

      transaction.set(orderRef, {
        userId: user.uid,
        userName: user.displayName || userData.name || "User",
        userEmail: user.email || userData.email || "",
        serviceName: servicePayload.serviceName || "Service",
        serviceFields: servicePayload.fieldsType || "",
        details: servicePayload.details || {},
        amountUsd: amountUsd,
        amountUSD: amountUsd,
        amountBdt: amountBdt,
        amountBDT: amountBdt,
        rate: USD_TO_BDT,
        rateBDT: USD_TO_BDT,
        paymentMethod: "credit",
        status: "paid_credit_pending_review",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    return { ok: true, orderId: orderRef.id };
  } catch (error) {
    if (error.message && error.message.startsWith("INSUFFICIENT_CREDIT")) {
      const balance = Number(error.message.split(":")[1] || 0);
      return { ok: false, reason: "insufficient", balance, message: `Insufficient credit. Current balance: ${usd(balance)}.` };
    }
    console.error("buyServiceWithCredit failed:", error);
    return { ok: false, reason: "error", message: error.message || "Credit payment failed." };
  }
};

window.loadAdminPanel = function () {
  onAuthStateChanged(auth, async (user) => {
    const topupList = document.getElementById("adminTopupList");
    const orderList = document.getElementById("adminOrderList");
    const adminInfo = document.getElementById("adminInfo");

    if (!user) {
      if (topupList) topupList.innerHTML = `<div class="empty-state">Please login with admin account first.</div>`;
      if (orderList) orderList.innerHTML = `<div class="empty-state">Please login with admin account first.</div>`;
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

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const purpose = data.purpose || "credit";
        const details = data.serviceDetails || {};
        topupList.innerHTML += `
          <div class="admin-card">
            <div class="admin-card-head">
              <h3>${usd(data.amountUsd || data.amountUSD || data.amount || 0)} / ${bdt(data.amountBdt || data.amountBDT || toBdt(data.amountUsd || data.amountUSD || 0))}</h3>
              <span class="status pending">pending</span>
            </div>
            <p><b>Purpose:</b> ${escapeHtml(purpose)}${data.serviceName ? " — " + escapeHtml(data.serviceName) : ""}</p>
            <p><b>User:</b> ${escapeHtml(data.userName || "User")}</p>
            <p><b>Email:</b> ${escapeHtml(data.userEmail || "No email")}</p>
            <p><b>Method:</b> ${escapeHtml(data.method)}</p>
            <p><b>Number:</b> ${escapeHtml(data.paymentNumber || "")}</p>
            <p><b>Transaction ID:</b> ${escapeHtml(data.transactionId)}</p>
            ${purpose === "service" ? `<div class="admin-details"><b>Service Details:</b><pre>${escapeHtml(JSON.stringify(details, null, 2))}</pre></div>` : ""}
            <div class="actions">
              <button class="confirm" onclick="approveTopup('${docSnap.id}')">Confirm Payment</button>
              <button class="decline" onclick="declineTopup('${docSnap.id}')">Decline Payment</button>
            </div>
          </div>
        `;
      });
    });

    const orderQuery = query(collection(db, "serviceOrders"), where("status", "in", ["paid_credit_pending_review", "paid_instant_pending_review"]));
    onSnapshot(orderQuery, (snapshot) => {
      if (!orderList) return;
      orderList.innerHTML = "";

      if (snapshot.empty) {
        orderList.innerHTML = `<div class="empty-state">No pending service order.</div>`;
        return;
      }

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        orderList.innerHTML += `
          <div class="admin-card">
            <div class="admin-card-head">
              <h3>${escapeHtml(data.serviceName || "Service")}</h3>
              <span class="status pending">review</span>
            </div>
            <p><b>Amount:</b> ${usd(data.amountUsd || data.amountUSD)} / ${bdt(data.amountBdt || data.amountBDT)}</p>
            <p><b>Payment:</b> ${escapeHtml(data.paymentMethod || "credit")}</p>
            <p><b>User:</b> ${escapeHtml(data.userName || "User")}</p>
            <p><b>Email:</b> ${escapeHtml(data.userEmail || "No email")}</p>
            <div class="admin-details"><b>Order Details:</b><pre>${escapeHtml(JSON.stringify(data.details || {}, null, 2))}</pre></div>
            <div class="actions">
              <button class="confirm" onclick="approveServiceOrder('${docSnap.id}')">Mark Completed</button>
              <button class="decline" onclick="declineServiceOrder('${docSnap.id}')">Decline Order</button>
            </div>
          </div>
        `;
      });
    });
  });
};

window.approveTopup = async function (topupId) {
  if (!confirm("Confirm this payment?")) return;

  try {
    const topupRef = doc(db, "topups", topupId);

    await runTransaction(db, async (transaction) => {
      const topupSnap = await transaction.get(topupRef);
      if (!topupSnap.exists()) throw new Error("Topup request not found");

      const topup = topupSnap.data();
      if (topup.status !== "pending") throw new Error("This request is already processed");

      transaction.update(topupRef, {
        status: "approved",
        approvedAt: serverTimestamp()
      });

      if ((topup.purpose || "credit") === "service") {
        const orderRef = doc(collection(db, "serviceOrders"));
        transaction.set(orderRef, {
          userId: topup.userId,
          userName: topup.userName || "User",
          userEmail: topup.userEmail || "",
          serviceName: topup.serviceName || "Service",
          details: topup.serviceDetails || {},
          amountUsd: Number(topup.amountUsd || topup.amountUSD || 0),
          amountUSD: Number(topup.amountUsd || topup.amountUSD || 0),
          amountBdt: Number(topup.amountBdt || topup.amountBDT || 0),
          amountBDT: Number(topup.amountBdt || topup.amountBDT || 0),
          rate: topup.rate || topup.rateBDT || USD_TO_BDT,
          rateBDT: topup.rate || topup.rateBDT || USD_TO_BDT,
          paymentMethod: "instant_pay",
          transactionId: topup.transactionId || "",
          topupId,
          status: "paid_instant_pending_review",
          createdAt: serverTimestamp()
        });
      } else {
        const userRef = doc(db, "users", topup.userId);
        transaction.update(userRef, {
          credit: increment(Number(topup.amountUsd || topup.amount || 0)),
          updatedAt: serverTimestamp()
        });
      }
    });

    alert("Payment confirmed successfully.");
  } catch (error) {
    alert(error.message);
  }
};

window.declineTopup = async function (topupId) {
  if (!confirm("Decline this payment request?")) return;

  try {
    const topupRef = doc(db, "topups", topupId);
    await updateDoc(topupRef, {
      status: "declined",
      declinedAt: serverTimestamp()
    });
    alert("Payment request declined.");
  } catch (error) {
    alert(error.message);
  }
};

window.approveServiceOrder = async function (orderId) {
  if (!confirm("Mark this service order as completed/accepted?")) return;
  try {
    await updateDoc(doc(db, "serviceOrders", orderId), {
      status: "accepted",
      acceptedAt: serverTimestamp()
    });
    alert("Service order accepted.");
  } catch (error) {
    alert(error.message);
  }
};

window.declineServiceOrder = async function (orderId) {
  if (!confirm("Decline this service order?")) return;
  try {
    await updateDoc(doc(db, "serviceOrders", orderId), {
      status: "declined",
      declinedAt: serverTimestamp()
    });
    alert("Service order declined.");
  } catch (error) {
    alert(error.message);
  }
};
