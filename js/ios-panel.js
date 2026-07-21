/**
 * ios-panel.js  —  Frontend panel logic
 *
 * Changes from broken version:
 *  - REMOVED all Firestore reads of iosKeyPool/{variant}/keys
 *  - REMOVED collectionGroup("keys") queries
 *  - "Buy with Credit" now calls POST /api/ios-panel-order exclusively
 *  - Key is shown from the backend response
 *  - UI / design / pricing untouched
 */

const IOS_PANEL_API = "https://rabbi-backend-production.up.railway.app/api/ios-panel-order";

/**
 * Get a fresh Firebase ID token for the current user.
 * Assumes `firebase.auth()` is available globally (Firebase v8 compat)
 * or swap with `getAuth().currentUser.getIdToken(true)` for v9+.
 */
async function getIdToken() {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error("User not signed in.");
  return user.getIdToken(/* forceRefresh */ true);
}

/**
 * Purchase an iOS panel key using the user's credit balance.
 *
 * @param {object} opts
 * @param {string} opts.variant       - "1d" | "7d" | "31d" | "setup"
 * @param {string} opts.variantLabel  - Human-readable label shown to user
 * @param {number} opts.amountUsd     - Price in USD
 * @param {string} opts.email         - User email
 * @param {string} opts.serviceId     - Service identifier
 * @param {string} opts.serviceName   - Service display name
 * @returns {Promise<{ ok: boolean, key: string|null, orderId: string }>}
 */
async function buyWithCredit({ variant, variantLabel, amountUsd, email, serviceId, serviceName }) {
  const token = await getIdToken();

  const response = await fetch(IOS_PANEL_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      variant,
      variantLabel,
      amountUsd,
      email,
      serviceId,
      serviceName,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    // Surface a meaningful error to the caller
    const code = data.error || "UNKNOWN_ERROR";
    const messages = {
      INSUFFICIENT_BALANCE : "Insufficient credit balance.",
      NO_KEYS_AVAILABLE    : "No keys available for this plan. Please try again later.",
      UNAUTHORIZED         : "Authentication failed. Please sign in again.",
      INVALID_VARIANT      : "Invalid plan selected.",
    };
    throw new Error(messages[code] || `Purchase failed: ${code}`);
  }

  return {
    ok      : true,
    key     : data.key,      // null for "setup" variant
    orderId : data.orderId,
    variant : data.variant,
    amountUsd: data.amountUsd,
  };
}

/**
 * Handle the "Buy with Credit" button click.
 * Wire this to whatever button / plan card triggers the purchase.
 *
 * Example:
 *   document.querySelector("#btn-buy-credit").addEventListener("click", () =>
 *     handleBuyWithCredit({ variant: "7d", variantLabel: "7 Days", amountUsd: 4.99,
 *                           email: currentUser.email, serviceId: "ios-panel",
 *                           serviceName: "iOS Panel" })
 *   );
 */
async function handleBuyWithCredit(planOptions) {
  // Disable UI / show loader — update these selectors to match your markup
  const buyBtn   = document.querySelector("#btn-buy-credit");
  const resultEl = document.querySelector("#key-result");

  if (buyBtn)   buyBtn.disabled = true;
  if (resultEl) resultEl.textContent = "Processing…";

  try {
    const { key, orderId } = await buyWithCredit(planOptions);

    if (key) {
      // Show the delivered key
      if (resultEl) {
        resultEl.innerHTML =
          `<strong>Your Key:</strong> <code>${key}</code>` +
          `<br><small>Order ID: ${orderId}</small>`;
      }
    } else {
      // "setup" variant — no key, pending manual delivery
      if (resultEl) {
        resultEl.textContent =
          `Order placed (ID: ${orderId}). Setup will be completed manually.`;
      }
    }
  } catch (err) {
    if (resultEl) resultEl.textContent = `Error: ${err.message}`;
    console.error("[ios-panel] buyWithCredit failed:", err);
  } finally {
    if (buyBtn) buyBtn.disabled = false;
  }
}

// ─── Exports (CommonJS / module bundler) ──────────────────────────────────────
// Remove if this file is used as a plain <script> tag without a bundler.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { buyWithCredit, handleBuyWithCredit };
}

window.placeIosOrder = async function (variantKey, email, btnEl) {
  const variants = {
    "1d": { label: "1 Day", price: 5 },
    "7d": { label: "7 Days", price: 14 },
    "31d": { label: "31 Days", price: 25 },
    "setup": { label: "Full Set-up", price: 40 }
  };

  const plan = variants[variantKey];
  if (!plan) throw new Error("Invalid iOS panel variant.");

  return handleBuyWithCredit({
    variant: variantKey,
    variantLabel: plan.label,
    amountUsd: plan.price,
    email,
    serviceId: "ffIos",
    serviceName: "Free Fire iPhone Panel (iOS)"
  });
};
