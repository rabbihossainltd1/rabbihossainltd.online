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

const PAYMENT_NUMBERS = {
  bKash: "01731410341",
  Nagad: "01731410341",
  Rocket: "01731410341"
};

let currentUser = null;

function money(value) {
  return `${Number(value || 0).toLocaleString("en-BD")} BDT`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
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
    await updateDoc(userRef, {
      name: user.displayName || snap.data().name || "User",
      email: user.email || snap.data().email || "",
      photoURL: user.photoURL || snap.data().photoURL || "",
      updatedAt: serverTimestamp()
    });
  }
}

function listenUserCredit(user) {
  const userRef = doc(db, "users", user.uid);
  onSnapshot(userRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    setText("userCredit", money(data.credit));
    setText("miniCredit", money(data.credit));
  });
}

window.loadWalletPage = function () {
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
  const selectedAmount = document.getElementById("selectedAmount");
  if (!amountEl) return;

  const isCustom = amountEl.value === "custom";
  if (customWrap) customWrap.style.display = isCustom ? "block" : "none";

  const customAmount = Number(document.getElementById("customAmount")?.value || 0);
  const amount = isCustom ? customAmount : Number(amountEl.value || 0);
  if (selectedAmount) selectedAmount.textContent = amount ? money(amount) : "Custom Amount";
};

window.submitTopup = async function () {
  if (!currentUser) {
    showMessage("আগে Login করো, তারপর payment request submit হবে।", "error");
    openLoginOrHome();
    return;
  }

  const method = document.getElementById("paymentMethod")?.value;
  const amountValue = document.getElementById("amount")?.value;
  const customAmount = document.getElementById("customAmount")?.value.trim();
  const transactionId = document.getElementById("transactionId")?.value.trim();

  const amount = amountValue === "custom" ? Number(customAmount) : Number(amountValue);

  if (!method) {
    showMessage("Payment method select করো।", "error");
    return;
  }

  if (!amount || amount < 10) {
    showMessage("Minimum 10 BDT amount দিতে হবে।", "error");
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

    await addDoc(collection(db, "topups"), {
      userId: currentUser.uid,
      userName: currentUser.displayName || "User",
      userEmail: currentUser.email || "",
      amount: amount,
      method: method,
      paymentNumber: PAYMENT_NUMBERS[method] || "",
      transactionId: transactionId,
      status: "pending",
      createdAt: serverTimestamp()
    });

    showMessage("Payment request submitted. Admin approval pending.", "success");
    document.getElementById("transactionId").value = "";
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Verify Payment";
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
            <strong>${money(data.amount)}</strong>
            <span class="status ${data.status}">${data.status}</span>
          </div>
          <p>Method: ${data.method}</p>
          <p>Transaction ID: ${data.transactionId}</p>
        </div>
      `;
    });
  });
};

window.loadAdminPanel = function () {
  onAuthStateChanged(auth, async (user) => {
    const list = document.getElementById("adminTopupList");
    const adminInfo = document.getElementById("adminInfo");

    if (!user) {
      if (list) list.innerHTML = `<div class="empty-state">Please login with admin account first.</div>`;
      return;
    }

    const adminRef = doc(db, "admins", user.uid);
    const adminSnap = await getDoc(adminRef);

    if (!adminSnap.exists()) {
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

    const q = query(collection(db, "topups"), where("status", "==", "pending"));

    onSnapshot(q, (snapshot) => {
      if (!list) return;
      list.innerHTML = "";

      if (snapshot.empty) {
        list.innerHTML = `<div class="empty-state">No pending payment request.</div>`;
        return;
      }

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.innerHTML += `
          <div class="admin-card">
            <div class="admin-card-head">
              <h3>${money(data.amount)}</h3>
              <span class="status pending">pending</span>
            </div>
            <p><b>User:</b> ${data.userName || "User"}</p>
            <p><b>Email:</b> ${data.userEmail || "No email"}</p>
            <p><b>Method:</b> ${data.method}</p>
            <p><b>Number:</b> ${data.paymentNumber || ""}</p>
            <p><b>Transaction ID:</b> ${data.transactionId}</p>
            <div class="actions">
              <button class="confirm" onclick="approveTopup('${docSnap.id}', '${data.userId}', ${Number(data.amount)})">Confirm Payment</button>
              <button class="decline" onclick="declineTopup('${docSnap.id}')">Decline Payment</button>
            </div>
          </div>
        `;
      });
    });
  });
};

window.approveTopup = async function (topupId, userId, amount) {
  if (!confirm("Confirm this payment and add credit?")) return;

  try {
    const topupRef = doc(db, "topups", topupId);
    const userRef = doc(db, "users", userId);

    await runTransaction(db, async (transaction) => {
      const topupSnap = await transaction.get(topupRef);

      if (!topupSnap.exists()) throw new Error("Topup request not found");

      const topup = topupSnap.data();
      if (topup.status !== "pending") throw new Error("This request is already processed");

      transaction.update(topupRef, {
        status: "approved",
        approvedAt: serverTimestamp(),
        approvedAmount: Number(amount)
      });

      transaction.update(userRef, {
        credit: increment(Number(amount)),
        updatedAt: serverTimestamp()
      });
    });

    alert("Payment confirmed and credit added.");
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
