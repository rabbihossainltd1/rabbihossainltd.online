/* ============================================================
   Cart Checkout — /cart/checkout/
   Shows the selected items + subtotal, lets the customer pick
   Balance or Instant Pay, then processes on "Pay Now".

   Balance  → sequential wallet purchases (buyServiceWithCredit)
   Instant  → single SPV top-up for the subtotal, then the items
              are placed from the credited wallet on return.
   ============================================================ */
(function () {
  'use strict';

  if (!document.getElementById('ccContent')) return;

  var BACKEND = 'https://rabbi-backend-vlr7.onrender.com';

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function loggedIn() {
    return !!(window.rabbiAuth && typeof window.rabbiAuth.isLoggedIn === 'function' && window.rabbiAuth.isLoggedIn());
  }
  function hasCached() {
    try { var c = JSON.parse(localStorage.getItem('rh_user_cache') || 'null'); return !!(c && c.uid); } catch (e) { return false; }
  }

  function showGate(show) {
    var gate = document.getElementById('ccLoginGate');
    var content = document.getElementById('ccContent');
    if (gate) gate.style.display = show ? '' : 'none';
    if (content) content.style.display = show ? 'none' : '';
  }

  // Read the items stashed by the cart page.
  var items = [];
  try { items = JSON.parse(localStorage.getItem('rh_cart_checkout') || '[]'); } catch (e) { items = []; }

  var payMethod = 'balance';
  var subtotalUsd = items.reduce(function (s, i) { return s + (Number(i.amountUsd) || 0) * (Number(i.qty) || 1); }, 0);

  function moneyBdt(v) { return '৳' + Math.round(Number(v || 0) * 125).toLocaleString('en-BD'); }
  function moneyUsd(v) { return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function render() {
    var list = document.getElementById('ccItemsList');
    if (list) {
      list.innerHTML = items.map(function (it) {
        var qty = Number(it.qty) || 1;
        var line = (Number(it.amountUsd) || 0) * qty;
        return '<div class="cc-item">' +
          (it.image ? '<img src="' + esc(it.image) + '" alt="">' : '') +
          '<div class="ci-body"><div class="ci-title">' + esc(it.title) + '</div>' +
          '<div class="ci-meta">' + (qty > 1 ? esc(qty) + ' × ' : '') + esc(moneyUsd(it.amountUsd)) + ' each</div></div>' +
          '<div class="ci-price">' + esc(moneyUsd(line)) + ' / ' + esc(moneyBdt(line)) + '</div>' +
        '</div>';
      }).join('');
    }
    document.getElementById('ccSubtotal').textContent = moneyUsd(subtotalUsd) + ' / ' + moneyBdt(subtotalUsd);
    document.getElementById('ccPayNowLabel').textContent = 'Pay Now (' + moneyBdt(subtotalUsd) + ')';
  }

  function selectMethod(m) {
    payMethod = m;
    var b = document.getElementById('ccPayBalance');
    var i = document.getElementById('ccPayInstant');
    if (b) b.classList.toggle('sel', m === 'balance');
    if (i) i.classList.toggle('sel', m === 'instant');
  }

  function setMsg(text, cls) {
    var m = document.getElementById('ccMsg');
    if (!m) return;
    m.textContent = text;
    m.className = 'cc-msg ' + (cls || '');
  }

  // ── backend helpers (same auth pattern as service-modal) ──
  async function backendPost(path, payload) {
    var user = window.rabbiAuth && window.rabbiAuth.getUser ? window.rabbiAuth.getUser() : null;
    if (!user || typeof user.getIdToken !== 'function') { var e = new Error('NOT_LOGGED_IN'); e.code = 'NOT_LOGGED_IN'; throw e; }
    var token = await user.getIdToken(true);
    var res = await fetch(BACKEND + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(payload || {})
    });
    var data = null;
    try { data = await res.json(); } catch (err) { data = { ok: false, error: 'INVALID_BACKEND_RESPONSE', message: 'Backend response was not JSON.' }; }
    if (!res.ok || !data.ok) {
      var err = new Error(data.message || data.error || ('Backend request failed: ' + res.status));
      err.code = data.error || 'BACKEND_ERROR';
      throw err;
    }
    return data;
  }

  async function backendGet(path) {
    var user = window.rabbiAuth && window.rabbiAuth.getUser ? window.rabbiAuth.getUser() : null;
    if (!user || typeof user.getIdToken !== 'function') throw new Error('NOT_LOGGED_IN');
    var token = await user.getIdToken(true);
    var res = await fetch(BACKEND + path, { headers: { 'Authorization': 'Bearer ' + token } });
    try { return await res.json(); } catch (e) { return null; }
  }

  async function placeAll() {
    var btn = document.getElementById('ccPayNowBtn');
    var done = [], failed = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      setMsg('Placing order: ' + it.title + ' (' + (i + 1) + '/' + items.length + ')…', 'info');
      try {
        var res = await window.buyServiceWithCredit({
          serviceName: it.serviceName || 'Service',
          serviceId: it.serviceId || 'service',
          amountUsd: (Number(it.amountUsd) || 0) * (Number(it.qty) || 1),
          details: it.details || {}
        });
        if (res && res.ok) done.push(it.id);
        else failed.push({ title: it.title, msg: (res && res.message) || 'Payment failed' });
      } catch (e) {
        failed.push({ title: it.title, msg: e && e.message ? e.message : 'Error' });
      }
    }
    if (failed.length) {
      setMsg('❌ ' + failed.length + '  orders failed: ' + failed.map(function (f) { return f.title; }).join(', ') + '. the rest were completed.', 'error');
    } else {
      setMsg('✅ All orders placed successfully!', 'success');
    }
    if (done.length && window.RhCart) window.RhCart.removeMany(done);
    try { localStorage.removeItem('rh_cart_checkout'); } catch (e) {}
    if (btn) { btn.disabled = false; }
    document.getElementById('ccPayNowLabel').textContent = 'Pay Now';
    if (!failed.length) {
      try {
        var payload = JSON.stringify({
          kind: 'cart',
          serviceName: 'Cart checkout',
          count: done.length,
          amountUsd: subtotalUsd,
          amountBdt: Math.round(Number(subtotalUsd || 0) * 125),
          ts: Date.now()
        });
        localStorage.setItem('rh_order_success', payload);
        sessionStorage.setItem('rh_order_success', payload);
      } catch (e) {}
      var w = null;
      try { w = window.open('/order-success/', '_blank'); } catch (e2) {}
      if (!w) window.location.assign('/order-success/');
    }
  }

  async function payNow() {
    if (!items.length) { setMsg('Checkout list is empty. Return to cart.', 'error'); return; }
    if (!window.buyServiceWithCredit) { setMsg('Payment engine not loaded — please refresh.', 'error'); return; }
    if (!loggedIn()) {
      window.rabbiAuth && window.rabbiAuth.openLogin && window.rabbiAuth.openLogin('cart');
      setMsg('Login to checkout.', 'error');
      return;
    }

    var btn = document.getElementById('ccPayNowBtn');
    btn.disabled = true;

    if (payMethod === 'balance') {
      btn.textContent = 'Processing…';
      await placeAll();
      return;
    }

    // ── Instant Pay: single SPV top-up for the subtotal ──
    btn.textContent = 'Creating payment link…';
    try {
      // Stash so the return trip can place the items.
      try {
        sessionStorage.setItem('rhCartPendingPayment', JSON.stringify({
          items: items,
          amountUsd: subtotalUsd,
          createdAt: new Date().toISOString()
        }));
      } catch (e) {}

      setMsg('Preparing payment link…', 'info');
      var data = await backendPost('/api/payment/spv/create-intent', { amountUsd: subtotalUsd });
      if (!data || !data.checkoutUrl) throw new Error('NO_CHECKOUT_URL');

      var rec = JSON.parse(sessionStorage.getItem('rhCartPendingPayment') || '{}');
      rec.topupId = data.topupId;
      rec.paymentId = data.paymentId;
      sessionStorage.setItem('rhCartPendingPayment', JSON.stringify(rec));

      window.location.href = data.checkoutUrl;
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Pay Now (' + moneyBdt(subtotalUsd) + ')';
      var code = err && err.code ? err.code : '';
      if (code === 'SPV_NOT_CONFIGURED') setMsg('Instant Pay is not available yet. Pay with balance.', 'error');
      else if (code === 'NOT_LOGGED_IN' || code === 'AUTH_TOKEN_NOT_AVAILABLE') setMsg('Login session expired — please sign in again.', 'error');
      else setMsg('Could not start payment. Please try again later.', 'error');
    }
  }

  // ── Resume: after SPV return, verify then place the items ──
  async function resumeIfPending() {
    var raw = null;
    try { raw = sessionStorage.getItem('rhCartPendingPayment'); } catch (e) { return; }
    if (!raw) return;
    var rec = null;
    try { rec = JSON.parse(raw); } catch (e) { return; }
    if (!rec || !rec.topupId || !(rec.items && rec.items.length)) return;
    if (!loggedIn()) return;

    var status = await backendGet('/api/payment/spv/status?topupId=' + encodeURIComponent(rec.topupId)).catch(function () { return null; });
    var topupStatus = status && (status.topupStatus || status.status);
    var verified = !!status && (topupStatus === 'approved' || status.spvStatus === 'verified' || status.credited === true);
    if (!verified) { setMsg('Payment not verified yet — check again shortly.', 'info'); return; }

    try { sessionStorage.removeItem('rhCartPendingPayment'); } catch (e) {}
    items = rec.items;
    subtotalUsd = rec.amountUsd;
    render();
    setMsg('Payment verified! Placing order…', 'info');
    await placeAll();
  }

  // wire
  var loginBtn = document.getElementById('ccLoginBtn');
  if (loginBtn) loginBtn.addEventListener('click', function () {
    window.rabbiAuth && window.rabbiAuth.openLogin && window.rabbiAuth.openLogin('cart');
  });
  var bBtn = document.getElementById('ccPayBalance');
  var iBtn = document.getElementById('ccPayInstant');
  if (bBtn) bBtn.addEventListener('click', function () { selectMethod('balance'); });
  if (iBtn) iBtn.addEventListener('click', function () { selectMethod('instant'); });
  var payNowBtn = document.getElementById('ccPayNowBtn');
  if (payNowBtn) payNowBtn.addEventListener('click', payNow);

  function boot() {
    if (!items.length) {
      showGate(false);
      document.getElementById('ccContent').style.display = '';
      document.getElementById('ccItemsList').innerHTML = '<p style="color:var(--text-secondary,#8b8b87);font-size:.85rem;">Checkout list is empty. <a href="/cart/" style="color:inherit;text-decoration:underline;">Back to cart</a>।</p>';
      document.getElementById('ccSubtotal').textContent = '$0 / ৳0';
      document.getElementById('ccPayNowBtn').style.display = 'none';
      return;
    }
    if (loggedIn() || hasCached()) { showGate(false); render(); }
    else { showGate(true); }
  }

  window.addEventListener('rabbi:loggedin', function () { showGate(false); if (items.length) render(); });
  window.addEventListener('rabbi:loggedout', function () { if (!hasCached()) showGate(true); });

  boot();
  var tries = 30;
  (function settle() {
    if (loggedIn()) { showGate(false); if (items.length) render(); resumeIfPending(); return; }
    if (tries-- > 0) setTimeout(settle, 150);
  })();
})();
