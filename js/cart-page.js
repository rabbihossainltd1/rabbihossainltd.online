/* ============================================================
   Cart page — renders the cart on /cart/.
   - Draft items show "Choose plan" → an inline plan picker popup
     (native, NOT the full checkout) for premium apps + FF panels.
     Services that need real fields (cards, FF top-up, custom work)
     fall back to the full checkout page in a new tab.
   - Configured items show a "Change" button to pick a different plan.
   - "Checkout & Pay" stashes the selected items and opens the
     dedicated checkout page (/cart/checkout/) in a NEW TAB.
   ============================================================ */
(function () {
  'use strict';

  if (!document.getElementById('cartContent')) return;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;'); }

  function loggedIn() {
    return !!(window.rabbiAuth && typeof window.rabbiAuth.isLoggedIn === 'function' && window.rabbiAuth.isLoggedIn());
  }
  function hasCached() {
    try { var c = JSON.parse(localStorage.getItem('rh_user_cache') || 'null'); return !!(c && c.uid); } catch (e) { return false; }
  }
  function userInfo() {
    var u = (window.rabbiAuth && window.rabbiAuth.getUser && window.rabbiAuth.getUser()) || null;
    if (u && (u.displayName || u.email)) return { name: u.displayName || '', email: u.email || '' };
    try {
      var c = JSON.parse(localStorage.getItem('rh_user_cache') || 'null');
      if (c) return { name: c.displayName || '', email: c.email || '' };
    } catch (e) {}
    return { name: '', email: '' };
  }

  function showGate(show) {
    var gate = document.getElementById('cartLoginGate');
    var content = document.getElementById('cartContent');
    if (gate) gate.style.display = show ? '' : 'none';
    if (content) content.style.display = show ? 'none' : '';
  }

  function selectedIds() {
    var set = [];
    document.querySelectorAll('input.cart-item-check:checked').forEach(function (c) { set.push(c.value); });
    return set;
  }

  /* ── plan picker helpers ──────────────────────────────────── */
  function svc(slug) {
    return (window.RH_PLANS && window.RH_PLANS.SERVICES) ? window.RH_PLANS.SERVICES[slug] : null;
  }
  // 'proapp' (premium apps) and 'ffPanel' (FF panels) have discrete plans
  // and can be picked inline. Everything else needs the full checkout form.
  function planKind(slug) {
    var s = svc(slug);
    if (!s) return 'complex';
    if (s.proapp) return 'proapp';
    if (s.fields && s.fields !== 'ff' && s.fields.indexOf('ff') === 0) return 'ffPanel';
    return 'complex';
  }
  function planOptions(item, kind) {
    if (kind === 'proapp') {
      var app = (window.RH_PLANS.APPS || []).find(function (a) { return a.id === (item.proapp || item.slug); });
      if (!app) return null;
      return app.plans.map(function (p) { return { key: p.label, label: p.label, usd: p.usd }; });
    }
    if (kind === 'ffPanel') {
      var s = svc(item.slug);
      var v = s && (window.RH_PLANS.FF_VARIANTS || {})[s.fields];
      if (!v) return null;
      return v.rows.map(function (r) { return { key: r[0], label: r[0], usd: r[2] }; });
    }
    return null;
  }
  function currentPlanKey(item) {
    if (item.needsPlan || !item.details) return '';
    var kind = planKind(item.slug);
    if (kind === 'proapp') return item.details.plan_type || '';
    if (kind === 'ffPanel') {
      var s = svc(item.slug);
      var v = s && (window.RH_PLANS.FF_VARIANTS || {})[s.fields];
      return v ? (item.details[v.name] || '') : '';
    }
    return '';
  }
  function buildDetails(item, kind, key, usd) {
    var user = userInfo();
    if (kind === 'proapp') {
      var app = (window.RH_PLANS.APPS || []).find(function (a) { return a.id === (item.proapp || item.slug); });
      return {
        app_name: app ? app.name : '',
        plan_type: key,
        plan_usd: String(usd),
        name: user.name,
        proapp_email: user.email,
        service_type: item.serviceName || 'Premium App & Subscription',
        _amount_usd: usd,
        source_page: 'cart'
      };
    }
    // ffPanel
    var s = svc(item.slug);
    var v = s && (window.RH_PLANS.FF_VARIANTS || {})[s.fields];
    var d = {};
    d[v.name] = key;
    d[v.email] = user.email;
    d.service_type = item.serviceName || (s && s.name) || '';
    d._amount_usd = usd;
    d.source_page = 'cart';
    return d;
  }

  /* ── inline plan picker ───────────────────────────────────── */
  function openPlan(item) {
    if (window.RhPlanPicker && typeof window.RhPlanPicker.open === 'function') {
      window.RhPlanPicker.open(item, { onDone: render });
      return;
    }
    var kind = planKind(item.slug);
    var options = planOptions(item, kind);
    if (!options) {
      if (window.rhCartToast) window.rhCartToast('Select a plan from the popup');
      return;
    }

    var modal = document.getElementById('rhPlanModal');
    var body = document.getElementById('rhPlanModalBody');
    var title = document.getElementById('rhPlanModalTitle');
    if (!modal || !body) return;
    if (title) title.textContent = item.title || 'Choose plan';

    var curKey = currentPlanKey(item);
    body.innerHTML = options.map(function (o) {
      var sel = o.key === curKey ? ' sel' : '';
      return '<button type="button" class="rh-plan-opt' + sel + '" data-key="' + esc(o.key) + '" data-usd="' + o.usd + '">' +
        '<span class="lbl">' + esc(o.label) + '</span>' +
        '<span class="p">' + window.RhCart.formatUsd(o.usd) + '<small>' + window.RhCart.formatBdt(o.usd) + '</small></span>' +
      '</button>';
    }).join('');

    body.querySelectorAll('.rh-plan-opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var usd = Number(btn.getAttribute('data-usd'));
        var key = btn.getAttribute('data-key');
        var configured = {
          slug: item.slug,
          title: item.title,
          image: item.image,
          amountUsd: usd,
          serviceName: item.serviceName || (svc(item.slug) ? svc(item.slug).name : ''),
          serviceId: item.serviceId || '',
          details: buildDetails(item, kind, key, usd)
        };
        if (item.needsPlan) {
          if (window.rhSetCartConfigured) window.rhSetCartConfigured(configured);
        } else {
          if (window.rhReplaceCartItem) window.rhReplaceCartItem(item.id, configured);
        }
        closePlan();
        render();
      });
    });

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closePlan() {
    var modal = document.getElementById('rhPlanModal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closePlan();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePlan();
  });

  function render() {
    var items = window.RhCart ? window.RhCart.get() : [];
    var list = document.getElementById('cartList');
    var footer = document.getElementById('cartFooter');
    if (!list) return;

    if (!items.length) {
      list.innerHTML = '<div class="cart-empty"><div class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22" stroke-linecap="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg></div><p>Your cart is empty.<br><a href="/services/">View services</a> and add products to your cart.</p></div>';
      if (footer) footer.style.display = 'none';
      var page0 = document.querySelector('.cart-page');
      if (page0) page0.classList.remove('has-cart-dock');
      return;
    }

    var html = '';
    items.forEach(function (item) {
      var planText = '';
      if (item.details) {
        if (item.details.plan_type) planText = item.details.plan_type;
        else if (item.details.meta_type) planText = item.details.meta_type;
        else if (item.details.card_type) planText = item.details.card_type;
        else if (item.details.packageName) planText = item.details.packageName;
      }
      if (item.needsPlan) {
        html +=
          '<div class="cart-item is-draft">' +
            '<span class="cart-item-check-slot"></span>' +
            (item.image ? '<img src="' + esc(item.image) + '" alt="">' : '<span class="cart-item-ph"></span>') +
            '<div class="cart-item-body">' +
              '<div class="cart-item-title">' + esc(item.title) + '</div>' +
              '<div class="cart-item-plan need">Select a plan</div>' +
            '</div>' +
            '<div class="cart-item-actions">' +
              '<button type="button" class="cart-choose-plan" data-id="' + esc(item.id) + '">Choose plan</button>' +
              '<button type="button" class="cart-remove" data-id="' + esc(item.id) + '">Remove</button>' +
            '</div>' +
          '</div>';
      } else {
        html +=
          '<div class="cart-item">' +
            '<input type="checkbox" class="cart-item-check" value="' + esc(item.id) + '" checked>' +
            (item.image ? '<img src="' + esc(item.image) + '" alt="">' : '<span class="cart-item-ph"></span>') +
            '<div class="cart-item-body">' +
              '<div class="cart-item-title">' + esc(item.title) + '</div>' +
              (planText ? '<div class="cart-item-plan">' + esc(planText) + '</div>' : '') +
              '<div class="cart-item-meta">' + (item.qty > 1 ? esc(item.qty) + ' × ' : '') + esc(window.RhCart.formatUsd(item.amountUsd)) + ' / ' + esc(window.RhCart.formatBdt(item.amountUsd)) + '</div>' +
            '</div>' +
            '<div class="cart-item-actions">' +
              '<button type="button" class="cart-choose-plan" data-id="' + esc(item.id) + '">Change</button>' +
              '<button type="button" class="cart-remove" data-id="' + esc(item.id) + '">Remove</button>' +
            '</div>' +
          '</div>';
      }
    });
    list.innerHTML = html;

    list.querySelectorAll('.cart-choose-plan').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var item = items.find(function (i) { return i.id === id; });
        if (item) openPlan(item);
      });
    });

    list.querySelectorAll('.cart-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (window.RhCart) window.RhCart.remove(btn.getAttribute('data-id'));
        render();
      });
    });

    list.querySelectorAll('.cart-item-check').forEach(function (c) {
      c.addEventListener('change', updateTotal);
    });

    var selAll = document.getElementById('cartSelectAll');
    if (selAll) {
      selAll.onclick = function () {
        list.querySelectorAll('.cart-item-check').forEach(function (c) { c.checked = selAll.checked; });
        updateTotal();
      };
    }

    updateTotal();
    if (footer) footer.style.display = '';
    var page = document.querySelector('.cart-page');
    if (page) page.classList.add('has-cart-dock');
  }

  function updateTotal() {
    var items = window.RhCart ? window.RhCart.get() : [];
    var set = {};
    document.querySelectorAll('input.cart-item-check:checked').forEach(function (c) { set[c.value] = 1; });
    var total = 0;
    items.forEach(function (i) { if (set[i.id]) total += (Number(i.amountUsd) || 0) * (Number(i.qty) || 1); });
    var t = document.getElementById('cartTotal');
    if (t) t.textContent = window.RhCart.formatUsd(total) + ' / ' + window.RhCart.formatBdt(total);
  }

  var payMethod = 'balance';
  var payItems = [];

  function setPayMsg(text, cls) {
    var m = document.getElementById('cartPayMsg');
    if (!m) return;
    m.textContent = text || '';
    m.className = 'cart-msg' + (cls ? ' ' + cls : '');
  }

  function showPayView(on) {
    var shop = document.getElementById('cartShopView');
    var pay = document.getElementById('cartPayView');
    if (shop) {
      shop.hidden = !!on;
      shop.style.display = on ? 'none' : '';
    }
    if (pay) {
      pay.hidden = !on;
      pay.style.display = on ? '' : 'none';
    }
    var footer = document.getElementById('cartFooter');
    var page = document.querySelector('.cart-page');
    if (on) {
      if (footer) footer.style.display = 'none';
      if (page) page.classList.remove('has-cart-dock');
    }
  }

  function renderPayView(chosen) {
    payItems = chosen.slice();
    var list = document.getElementById('cartPayItems');
    var sub = 0;
    if (list) {
      list.innerHTML = chosen.map(function (it) {
        var qty = Number(it.qty) || 1;
        var line = (Number(it.amountUsd) || 0) * qty;
        sub += line;
        return '<div class="checkout-item">' +
          (it.image ? '<img src="' + esc(it.image) + '" alt="">' : '') +
          '<div class="ci-body"><div class="ci-title">' + esc(it.title) + '</div>' +
          '<div class="ci-meta">' + (qty > 1 ? esc(qty) + ' × ' : '') + esc(window.RhCart.formatUsd(it.amountUsd)) + '</div></div>' +
          '<div class="ci-price">' + esc(window.RhCart.formatUsd(line)) + ' / ' + esc(window.RhCart.formatBdt(line)) + '</div>' +
        '</div>';
      }).join('');
    }
    var st = document.getElementById('cartPaySubtotal');
    if (st) st.textContent = window.RhCart.formatUsd(sub) + ' / ' + window.RhCart.formatBdt(sub);
    var lbl = document.getElementById('cartPayNowLabel');
    if (lbl) lbl.textContent = 'Pay Now (' + window.RhCart.formatBdt(sub) + ')';
    setPayMsg('', '');
  }

  function selectPay(m) {
    payMethod = m;
    var b = document.getElementById('cartPayBalance');
    var i = document.getElementById('cartPayInstant');
    if (b) b.classList.toggle('sel', m === 'balance');
    if (i) i.classList.toggle('sel', m === 'instant');
  }

  function openCheckout() {
    var items = window.RhCart ? window.RhCart.get() : [];
    var ids = selectedIds();
    var chosen = items.filter(function (i) { return !i.needsPlan && (ids.length ? ids.indexOf(i.id) !== -1 : true); });
    if (!chosen.length) {
      var draft = items.find(function (i) { return i.needsPlan; });
      var msg = document.getElementById('cartCheckoutMsg');
      if (msg) {
        msg.textContent = draft ? '"' + draft.title + '" select a plan first.' : 'Select at least one product.';
        msg.className = 'cart-msg error';
      }
      return;
    }
    if (!loggedIn() && !hasCached()) {
      window.rabbiAuth && window.rabbiAuth.openLogin && window.rabbiAuth.openLogin('cart');
      var m2 = document.getElementById('cartCheckoutMsg');
      if (m2) { m2.textContent = 'Login to checkout.'; m2.className = 'cart-msg error'; }
      return;
    }
    renderPayView(chosen);
    showPayView(true);
  }

  async function placeAll() {
    var btn = document.getElementById('cartPayNowBtn');
    var done = [], failed = [];
    for (var i = 0; i < payItems.length; i++) {
      var it = payItems[i];
      setPayMsg('Placing order: ' + it.title + ' (' + (i + 1) + '/' + payItems.length + ')…', 'info');
      try {
        var res = await window.buyServiceWithCredit({
          serviceName: it.serviceName || 'Service',
          serviceId: it.serviceId || 'service',
          amountUsd: (Number(it.amountUsd) || 0) * (Number(it.qty) || 1),
          details: it.details || {}
        });
        if (res && res.ok) done.push(it.id);
        else failed.push(it.title);
      } catch (e) {
        failed.push(it.title);
      }
    }
    if (failed.length) setPayMsg(failed.length + ' order(s) failed: ' + failed.join(', '), 'error');
    else setPayMsg('All orders placed successfully.', 'success');
    if (done.length && window.RhCart) window.RhCart.removeMany(done);
    if (btn) btn.disabled = false;
    if (!failed.length) {
      try {
        var payload = JSON.stringify({
          kind: 'cart',
          serviceName: 'Cart checkout',
          count: done.length,
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
    if (!payItems.length) { setPayMsg('Checkout list is empty.', 'error'); return; }
    if (!window.buyServiceWithCredit) { setPayMsg('Payment engine not loaded — please refresh.', 'error'); return; }
    if (!loggedIn()) {
      window.rabbiAuth && window.rabbiAuth.openLogin && window.rabbiAuth.openLogin('cart');
      setPayMsg('Login to checkout.', 'error');
      return;
    }
    var btn = document.getElementById('cartPayNowBtn');
    if (btn) btn.disabled = true;
    if (payMethod === 'balance') {
      await placeAll();
      return;
    }
    var subtotalUsd = payItems.reduce(function (s, i) { return s + (Number(i.amountUsd) || 0) * (Number(i.qty) || 1); }, 0);
    setPayMsg('Preparing payment link…', 'info');
    try {
      var user = window.rabbiAuth && window.rabbiAuth.getUser && window.rabbiAuth.getUser();
      if (!user || typeof user.getIdToken !== 'function') throw new Error('NOT_LOGGED_IN');
      var token = await user.getIdToken(true);
      var res = await fetch('https://rabbi-backend-vlr7.onrender.com/api/payment/spv/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ amountUsd: subtotalUsd })
      });
      var data = null;
      try { data = await res.json(); } catch (e) { data = {}; }
      if (!res.ok || !data.ok || !data.checkoutUrl) throw new Error(data.message || 'NO_CHECKOUT_URL');
      try {
        sessionStorage.setItem('rhCartPendingPayment', JSON.stringify({
          items: payItems, amountUsd: subtotalUsd, topupId: data.topupId, paymentId: data.paymentId
        }));
      } catch (e) {}
      window.location.href = data.checkoutUrl;
    } catch (err) {
      if (btn) btn.disabled = false;
      setPayMsg('Could not start Instant Pay. Use Balance Pay.', 'error');
    }
  }

  // wire
  var loginBtn = document.getElementById('cartLoginBtn');
  if (loginBtn) loginBtn.addEventListener('click', function () {
    window.rabbiAuth && window.rabbiAuth.openLogin && window.rabbiAuth.openLogin('cart');
  });
  var checkoutBtn = document.getElementById('cartCheckoutBtn');
  if (checkoutBtn) checkoutBtn.addEventListener('click', openCheckout);
  var backBtn = document.getElementById('cartPayBack');
  if (backBtn) backBtn.addEventListener('click', function () { showPayView(false); render(); });
  var bBtn = document.getElementById('cartPayBalance');
  var iBtn = document.getElementById('cartPayInstant');
  if (bBtn) bBtn.addEventListener('click', function () { selectPay('balance'); });
  if (iBtn) iBtn.addEventListener('click', function () { selectPay('instant'); });
  var payNowBtn = document.getElementById('cartPayNowBtn');
  if (payNowBtn) payNowBtn.addEventListener('click', payNow);
  if (new URLSearchParams(location.search).get('pay') === '1') {
    setTimeout(openCheckout, 80);
  }

  window.addEventListener('rh:cart', render);
  // Cross-tab sync: if the checkout page (in another tab) configures an item.
  window.addEventListener('storage', function (e) {
    if (e.key === 'rh_cart') render();
  });

  function boot() {
    if (loggedIn() || hasCached()) showGate(false);
    else showGate(true);
    render();
  }
  window.addEventListener('rabbi:loggedin', function () { showGate(false); render(); });
  window.addEventListener('rabbi:loggedout', function () { if (!hasCached()) showGate(true); });

  boot();
  var tries = 30;
  (function settle() {
    if (loggedIn()) { showGate(false); render(); return; }
    if (tries-- > 0) setTimeout(settle, 150);
  })();
})();
