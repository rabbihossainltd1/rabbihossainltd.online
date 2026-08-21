/* ============================================================
   Service Order Modal — v4.0
   - New FF panel fields: ffDrip, ffFf4x, ffIos, ffPc
   - Diamond top-up: no name/email/phone
   - FF Panels: email only (no name/phone)
   - Fix: admin panel requests now saved to Firestore
   - Fix: amount field editable by admin only (price fixed per service)
   - Fix: contact fields hidden for FF/diamond services
   ============================================================ */

(function () {
  'use strict';

  const FORMSPREE = 'https://formspree.io/f/mojybwvn';
  const BACKEND_API_BASE = 'https://rabbi-backend-vlr7.onrender.com';

  function backendRoute(path) {
    if (!path) return '/api/health';
    if (path.startsWith('/api/index')) return path;
    if (path.startsWith('/api/')) {
      return '/api/' + encodeURIComponent(path.replace('/api/', ''));
    }
    return path;
  }

  /**
   * Call a backend route whose path must be sent verbatim.
   * backendPost() percent-encodes the segments after /api/ (a legacy quirk the
   * older single-function endpoints rely on), which breaks nested routes such
   * as /api/payment/spv/create-intent. Use this for those.
   */
  async function backendPostRaw(path, payload, method) {
    if (!window.rabbiAuth || !window.rabbiAuth.isLoggedIn() || !window.rabbiAuth.getUser()) {
      const e = new Error('NOT_LOGGED_IN'); e.code = 'NOT_LOGGED_IN'; throw e;
    }
    const user = window.rabbiAuth.getUser();
    if (!user || typeof user.getIdToken !== 'function') {
      const e = new Error('AUTH_TOKEN_NOT_AVAILABLE'); e.code = 'AUTH_TOKEN_NOT_AVAILABLE'; throw e;
    }
    const token = await user.getIdToken(true);

    const opts = {
      method: method || 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    };
    if (opts.method !== 'GET') opts.body = JSON.stringify(payload || {});

    const response = await fetch(BACKEND_API_BASE + path, opts);
    let data = null;
    try { data = await response.json(); } catch (err) {
      data = { ok: false, error: 'INVALID_BACKEND_RESPONSE', message: 'Backend response was not JSON.' };
    }
    if (!response.ok || !data.ok) {
      const error = new Error(data.message || data.error || ('Backend request failed: ' + response.status));
      error.code = data.error || 'BACKEND_ERROR';
      error.response = data;
      throw error;
    }
    return data;
  }

  async function backendPost(path, payload) {
    if (!window.rabbiAuth || !window.rabbiAuth.isLoggedIn() || !window.rabbiAuth.getUser()) {
      throw new Error('NOT_LOGGED_IN');
    }

    const user = window.rabbiAuth.getUser();
    if (!user || typeof user.getIdToken !== 'function') {
      throw new Error('AUTH_TOKEN_NOT_AVAILABLE');
    }

    const token = await user.getIdToken(true);


    const response = await fetch(BACKEND_API_BASE + backendRoute(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(payload || {})
    });

    let data = null;
    try {
      data = await response.json();
    } catch (err) {
      data = { ok: false, error: 'INVALID_BACKEND_RESPONSE', message: 'Backend response was not JSON.' };
    }

    if (!response.ok || !data.ok) {
      const error = new Error(data.message || data.error || ('Backend request failed: ' + response.status));
      error.code = data.error || 'BACKEND_ERROR';
      error.response = data;
      throw error;
    }

    return data;
  }

  async function buyIosPanelWithCreditDirect(amountUsd) {
    const amount = Number(amountUsd || 0);
    const variant = amount === 5 ? '1d' : amount === 14 ? '7d' : amount === 25 ? '31d' : amount === 40 ? 'setup' : '';
    if (!variant) return { ok: false, reason: 'amount', message: 'Invalid iOS panel variant.' };

    try {
      const data = await backendPost('/api/ios-panel-order', { variant, amountUsd: amount });
      return {
        ok: true,
        variant,
        orderId: data.orderId,
        key: data.key || null,
        status: data.status,
        amountUsd: Number(data.amountUsd || amount),
        amountBdt: Number(data.amountBdt || Math.round(amount * 125)),
        newCredit: data.newCredit
      };
    } catch (error) {
      if (error.message === 'NOT_LOGGED_IN' || error.code === 'NOT_LOGGED_IN') return { ok: false, reason: 'login', message: 'Please login first.' };
      if (error.code === 'INSUFFICIENT_BALANCE' || /insufficient/i.test(error.message || '')) return { ok: false, reason: 'insufficient', message: 'Insufficient balance. Please add credit.' };
      if (error.code === 'NO_KEYS_AVAILABLE') return { ok: false, reason: 'stock', message: 'This variant is currently out of stock.' };
      return { ok: false, reason: 'error', message: error.message || 'iOS panel purchase failed.' };
    }
  }

  async function buyServiceWithCreditDirect(servicePayload) {
    const amountUsd = Number(servicePayload.amountUsd || 0);
    const baseAmountUsd = Number(servicePayload.baseAmountUsd || servicePayload.amountUsd || 0);
    // Use base (pre-discount) amount for existence check; discounted amount can be 0 on 100% coupon
    if (!baseAmountUsd || baseAmountUsd <= 0) {
      return { ok: false, reason: 'amount', message: 'Valid service amount required.' };
    }

    try {
      const data = await backendPost('/api/buy-service', {
        serviceName: servicePayload.serviceName || 'Service',
        serviceId: servicePayload.fieldsType || servicePayload.serviceId || 'service',
        amountUsd,
        serviceDetails: servicePayload.details || {}
      });

      return {
        ok: true,
        orderId: data.orderId,
        amountUsd,
        amountBdt: Math.round(amountUsd * 125),
        newCredit: data.newCredit
      };
    } catch (error) {

      if (error.message === 'NOT_LOGGED_IN' || error.code === 'NOT_LOGGED_IN') return { ok: false, reason: 'login', message: 'Please login first.' };
      if (error.code === 'INSUFFICIENT_BALANCE' || /insufficient/i.test(error.message || '')) return { ok: false, reason: 'insufficient', message: 'Insufficient balance. Please add credit.' };
      if (error.code === 'INVALID_PRICE') return { ok: false, reason: 'amount', message: 'Invalid service price.' };
      if (/permission|token|cors|auth/i.test(error.message || '') || ['INVALID_TOKEN','AUTH_TOKEN_NOT_AVAILABLE'].includes(error.code)) return { ok: false, reason: 'permission', message: error.message || 'Backend permission/auth error.' };
      return { ok: false, reason: 'error', message: error.message || 'Service purchase failed.' };
    }
  }

  // Fixed prices — user cannot change these
  const FIXED_SERVICE_PRICES = {
    'Facebook Meta Verified': 12,
    'Visa / Mastercard': 0,
    'Premium App & Subscription': 0,
    'Website Development': 50,
    'Ethical Hacking / Security Audit': 30,
    'Android App Development': 40,
    'Digital Branding': 15,
    'Premium Digital Services': 10,
    'Free Fire Diamond Top-up': 0,      // set dynamically via radio
    'Free Fire Android Panel (Drip)': 0,
    'Free Fire Android Panel (FF4X)': 0,
    'Free Fire iPhone Panel (iOS)': 0,
    'Free Fire PC Panel': 0
  };

  // Services that hide name/email/phone contact fields — they have their own email
  const NO_CONTACT_FIELDS = ['ff','ffDrip','ffFf4x','ffIos','ffPc','ffBrMods'];

  const overlay = document.getElementById('serviceModal');
  const modalClose = document.getElementById('modalClose');
  const modalTitle = document.getElementById('modalTitle');
  const modalSub = document.getElementById('modalSubtitle');
  const serviceInput = document.getElementById('modalServiceType');
  const form = document.getElementById('serviceOrderForm');
  const submitBtn = document.getElementById('modalSubmitBtn');
  const statusEl = document.getElementById('modalStatus');

  const allFieldIds = {
    webDev: 'webDevFields',
    security: 'securityFields',
    android: 'androidFields',
    meta: 'metaFields',
    card: 'cardFields',
    proapp: 'proappFields',
    ff: 'ffFields',
    ffDrip: 'ffDripFields',
    ffFf4x: 'ffFf4xFields',
    ffIos: 'ffIosFields',
    ffPc: 'ffPcFields',
    ffBrMods: 'ffBrModsFields'
  };

  // Visa / Mastercard fixed price options — no custom price allowed
  const CARD_PRICE_OPTIONS = {
    Physical: [110, 550, 1200],
    Virtual: [12, 55, 105]
  };

  function moneyBdtFromUsdRaw(value) {
    return Math.round(Number(value || 0) * 125);
  }

  function formatBdt(value) {
    return `৳${Number(value || 0).toLocaleString('en-BD')}`;
  }

  function configureCardPriceOptions(cardType) {
    const priceGroup = document.getElementById('cardPriceGroup');
    const priceSelect = document.getElementById('mo_card_price');
    const priceHidden = document.getElementById('mo_card_price_usd');
    if (!priceGroup || !priceSelect) return;

    const options = CARD_PRICE_OPTIONS[cardType] || [];
    priceSelect.innerHTML = '<option value="">Select card price…</option>';

    options.forEach((price) => {
      const opt = document.createElement('option');
      opt.value = String(price);
      opt.textContent = `${cardType} Card — $${Number(price).toLocaleString('en-US')} / ${formatBdt(moneyBdtFromUsdRaw(price))}`;
      priceSelect.appendChild(opt);
    });

    priceGroup.style.display = options.length ? 'block' : 'none';
    priceSelect.required = !!options.length;
    if (priceHidden) priceHidden.value = '';
    _currentAmountUsd = 0;
    if (typeof window.updateServiceAmountUI === 'function') window.updateServiceAmountUI();
  }

  function resetCardPricing() {
    const priceGroup = document.getElementById('cardPriceGroup');
    const priceSelect = document.getElementById('mo_card_price');
    const priceHidden = document.getElementById('mo_card_price_usd');
    const addrGroup = document.getElementById('cardAddressGroup');
    const addrTextarea = document.getElementById('mo_card_address');
    if (priceGroup) priceGroup.style.display = 'none';
    if (priceSelect) {
      priceSelect.innerHTML = '<option value="">Select card price…</option>';
      priceSelect.required = false;
    }
    if (priceHidden) priceHidden.value = '';
    if (addrGroup) addrGroup.style.display = 'none';
    if (addrTextarea) addrTextarea.required = false;
  }

  document.addEventListener('change', function(e) {
    if (e.target && e.target.name === 'card_type') {
      const addrGroup = document.getElementById('cardAddressGroup');
      if (addrGroup) {
        addrGroup.style.display = e.target.value === 'Physical' ? 'block' : 'none';
        const addrTextarea = document.getElementById('mo_card_address');
        if (addrTextarea) addrTextarea.required = e.target.value === 'Physical';
      }
      configureCardPriceOptions(e.target.value);
    }

    if (e.target && e.target.id === 'mo_card_price') {
      const selected = Number(e.target.value || 0);
      const priceHidden = document.getElementById('mo_card_price_usd');
      if (priceHidden) priceHidden.value = selected ? String(selected) : '';
      _currentAmountUsd = selected ? Math.round(selected * 100) / 100 : 0;
      if (typeof window.updateServiceAmountUI === 'function') window.updateServiceAmountUI();
    }
  });

  let activeServiceName = '';
  let activeFieldsType = '';
  let _currentAmountUsd = 0;

  // Global setter so proapp plan picker can update amount directly
  window.setServiceAmountUsd = function(usd) {
    _currentAmountUsd = Math.round(Number(usd) * 10000) / 10000;
    if (typeof window.updateServiceAmountUI === 'function') window.updateServiceAmountUI();
  };

  // Listen for programmatic change on serviceAmountUsd hidden input
  document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'serviceAmountUsd') {
      const v = parseFloat(e.target.value) || 0;
      _currentAmountUsd = v;
      if (typeof window.updateServiceAmountUI === 'function') window.updateServiceAmountUI();
    }
  });

  function moneyUsd(value) {
    return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: Number(value || 0) < 1 ? 3 : 2, maximumFractionDigits: 4 })}`;
  }

  function moneyBdtFromUsd(value) {
    return `৳${Math.round(Number(value || 0) * 125).toLocaleString('en-BD')}`;
  }

  function moneyPair(value) {
    return `${moneyUsd(value)} / ${moneyBdtFromUsd(value)}`;
  }

  function showStatus(message, type) {
    if (!statusEl) return;
    statusEl.className = 'service-modal-status ' + (type || '');
    statusEl.textContent = message || '';
  }

  function ensureServiceSuccessStyle() {
    if (document.getElementById('serviceSuccessStyle')) return;
    const style = document.createElement('style');
    style.id = 'serviceSuccessStyle';
    style.textContent = `
      .service-success-animation{
        display:grid;
        place-items:center;
        text-align:center;
        padding:34px 18px 42px;
        animation:svcSuccessFade .35s ease both;
      }
      .service-success-ring{
        width:96px;height:96px;border-radius:50%;
        display:grid;place-items:center;
        background:radial-gradient(circle,rgba(255, 255, 255,.22),rgba(255, 255, 255,.10));
        border:1px solid rgba(255, 255, 255,.32);
        box-shadow:0 0 40px rgba(255, 255, 255,.28);
        margin-bottom:22px;
        position:relative;
      }
      .service-success-ring:before{
        content:"";position:absolute;inset:-10px;border-radius:50%;
        border:1px solid rgba(255, 255, 255,.24);
        animation:svcPulse 1.2s ease-out infinite;
      }
      .service-success-ring svg{width:44px;height:44px;color:#ffffff;stroke-dasharray:60;stroke-dashoffset:60;animation:svcDraw .55s ease .15s forwards;}
      .service-success-animation h3{
        font-family:var(--font-display);font-size:1.55rem;color:#f8f8f7;margin:0 0 8px;
      }
      .service-success-animation p{
        color:#adada9;line-height:1.7;max-width:420px;margin:0 auto 18px;
      }
      .service-success-badges{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;}
      .service-success-badges span{
        padding:7px 11px;border-radius:999px;background:rgba(255, 255, 255,.08);
        border:1px solid rgba(255, 255, 255,.18);color:#d4d4d2;font-size:.78rem;font-weight:900;
      }
      .service-success-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px;}
      .service-success-actions a,.service-success-actions button{
        border:0;text-decoration:none;cursor:pointer;border-radius:999px;padding:11px 16px;
        font-weight:900;font-family:inherit;
      }
      .service-success-actions a{background:#ffffff;color:#080808;}
      .service-success-actions button{background:rgba(255,255,255,.08);color:#eeeeed;border:1px solid rgba(255,255,255,.12);}
      @keyframes svcSuccessFade{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
      @keyframes svcPulse{0%{transform:scale(.85);opacity:.9}100%{transform:scale(1.25);opacity:0}}
      @keyframes svcDraw{to{stroke-dashoffset:0}}
    `;
    document.head.appendChild(style);
  }

  function showServiceSuccess(result, amountUsd) {
    // Close modal immediately
    const overlay = document.getElementById('serviceModal');
    if (overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; }

    // Show full-screen order-placed overlay
    let ov = document.getElementById('orderPlacedOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'orderPlacedOverlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);backdrop-filter:blur(14px);padding:20px;';
      document.body.appendChild(ov);
    }

    const bdtAmt = Math.round((amountUsd || 0) * 125);
    const usdStr = amountUsd ? `$${Number(amountUsd).toFixed(2)}` : '';
    const bdtStr = bdtAmt ? `৳${bdtAmt.toLocaleString()}` : '';

    ov.innerHTML = `
      <div style="width:min(420px,100%);border-radius:28px;padding:36px 28px 28px;text-align:center;
        background:linear-gradient(180deg,rgba(255, 255, 255,.10) 0%,rgba(255, 255, 255,.06) 100%);
        border:1px solid rgba(255, 255, 255,.28);
        box-shadow:0 40px 100px rgba(0,0,0,.5),0 0 60px rgba(255, 255, 255,.08);
        animation:opIn .5s cubic-bezier(.2,1,.2,1) both;">

        <!-- Animated checkmark ring -->
        <div style="width:88px;height:88px;border-radius:50%;margin:0 auto 22px;position:relative;
          background:rgba(255, 255, 255,.12);border:2px solid rgba(255, 255, 255,.35);
          display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid rgba(255, 255, 255,.18);animation:opRing 1.6s ease-out infinite;"></div>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:opCheck .6s ease .15s both;">
            <path d="M20 6 9 17l-5-5"/>
          </svg>
        </div>

        <!-- Title -->
        <div style="display:inline-flex;align-items:center;gap:8px;padding:5px 14px;border-radius:999px;
          background:rgba(255, 255, 255,.10);border:1px solid rgba(255, 255, 255,.22);
          color:#dfe9e0;font-size:.72rem;font-weight:900;letter-spacing:.06em;text-transform:uppercase;margin-bottom:14px;">
          <span style="width:7px;height:7px;border-radius:50%;background:#ffffff;display:inline-block;animation:opDot 1s ease-in-out infinite;"></span>
          Order Placed
        </div>

        <h2 style="font-family:var(--font-display,inherit);font-size:1.65rem;color:#f8f8f7;margin:0 0 10px;line-height:1.2;">
          Your Order is Placed!
        </h2>
        <p style="color:#b1b1ae;line-height:1.72;margin:0 0 6px;font-size:.93rem;">
          Please wait a few moments to complete the order.
        </p>
        <p style="color:#8f8f8a;font-size:.83rem;margin:0 0 22px;">
          It takes maximum <strong style="color:#ffa500;">10–15 minutes</strong> to process.
        </p>

        ${usdStr ? `
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:22px;">
          <span style="padding:8px 16px;border-radius:999px;background:rgba(255, 255, 255,.10);border:1px solid rgba(255, 255, 255,.20);color:#dfe9e0;font-weight:900;font-size:.88rem;">${usdStr}</span>
          ${bdtStr ? `<span style="padding:8px 16px;border-radius:999px;background:rgba(255, 255, 255,.10);border:1px solid rgba(255, 255, 255,.20);color:#e4e4e0;font-weight:900;font-size:.88rem;">${bdtStr}</span>` : ''}
          <span style="padding:8px 16px;border-radius:999px;background:rgba(255,166,0,.10);border:1px solid rgba(255,166,0,.20);color:#ffd580;font-weight:900;font-size:.88rem;">Processing</span>
        </div>` : ''}

        <!-- Redirect info -->
        <div style="padding:14px 16px;border-radius:16px;background:rgba(255, 255, 255,.06);border:1px solid rgba(255, 255, 255,.14);
          display:flex;align-items:center;gap:12px;text-align:left;margin-bottom:22px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" style="flex-shrink:0;">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          <div>
            <div style="color:#e4e4e0;font-weight:900;font-size:.83rem;">Redirecting to My Orders…</div>
            <div style="color:#7c7c77;font-size:.76rem;margin-top:2px;">Track your order status live from there.</div>
          </div>
        </div>

        <button id="opGoNow" type="button" style="width:100%;border:none;border-radius:16px;padding:15px;
          background:#ffffff;color:#080808;font-weight:950;font-size:.98rem;cursor:pointer;
          box-shadow:0 16px 40px rgba(255, 255, 255,.2);margin-bottom:10px;">
          View My Orders Now
        </button>
        <button id="opRateBtn" type="button" style="width:100%;border:1px solid rgba(255,165,0,.3);border-radius:16px;padding:12px;
          background:rgba(255,165,0,.08);color:#ffc14d;font-weight:800;font-size:.88rem;cursor:pointer;
          display:flex;align-items:center;justify-content:center;gap:8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          Rate Your Experience
        </button>
      </div>
    `;

    // Inject animation keyframes once
    if (!document.getElementById('opAnimStyle')) {
      const s = document.createElement('style');
      s.id = 'opAnimStyle';
      s.textContent = `
        @keyframes opIn{from{opacity:0;transform:scale(.88) translateY(24px)}to{opacity:1;transform:none}}
        @keyframes opRing{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.5);opacity:0}}
        @keyframes opCheck{from{stroke-dasharray:50;stroke-dashoffset:50}to{stroke-dashoffset:0}}
        @keyframes opDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.6)}}
      `;
      document.head.appendChild(s);
    }

    // Button click → go to orders
    document.getElementById('opGoNow')?.addEventListener('click', () => {
      window.location.href = '/dashboard/?tab=orders';
    });

    // Rate button → open review modal, cancel auto-redirect
    const rateBtn = document.getElementById('opRateBtn');
    let autoRedirect = setTimeout(() => {
      window.location.href = '/dashboard/?tab=orders';
    }, 4000);

    rateBtn?.addEventListener('click', () => {
      clearTimeout(autoRedirect);
      const ov = document.getElementById('orderPlacedOverlay');
      if (ov) ov.remove();
      if (typeof window.openReviewModal === 'function') {
        window.openReviewModal(typeof activeServiceName !== 'undefined' ? activeServiceName : '');
      }
    });
  }


  function showFields(type) {
    // Hide all specific field divs
    Object.values(allFieldIds).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    // Show or hide standard contact fields
    const contactFields = document.getElementById('standardContactFields');
    if (contactFields) {
      contactFields.style.display = NO_CONTACT_FIELDS.includes(type) ? 'none' : 'block';
    }

    // Show the specific type
    if (type && allFieldIds[type]) {
      const el = document.getElementById(allFieldIds[type]);
      if (el) el.style.display = 'block';
    }
  }

  // Expose for inline onchange in HTML
  window.updateServiceAmountUI = function() {
    const usdEl = document.getElementById('servicePriceUsd');
    const bdtEl = document.getElementById('servicePriceBdt');
    if (usdEl) usdEl.textContent = _currentAmountUsd ? moneyUsd(_currentAmountUsd) : '$0';
    if (bdtEl) bdtEl.textContent = _currentAmountUsd ? moneyBdtFromUsd(_currentAmountUsd) : '৳0';
    // also update the hidden amount input
    const inp = document.getElementById('serviceAmountUsd');
    if (inp) inp.value = _currentAmountUsd;
    // Pay Now button label
    const payNowLabel = document.getElementById('payNowLabel');
    if (payNowLabel) payNowLabel.textContent = _currentAmountUsd ? ('Pay Now · ' + moneyBdtFromUsd(_currentAmountUsd)) : 'Pay Now';
    // refresh coupon discount display
    if (typeof refreshCouponPriceUI === 'function') refreshCouponPriceUI();
  };

  // Called from inline HTML when FF radio options are selected
  const _origFfUpdateAmount = window.ffUpdateAmount;
  window.ffUpdateAmount = function(usd) {
    _currentAmountUsd = Math.round(Number(usd) * 10000) / 10000;
    window.updateServiceAmountUI();
    const inp = document.getElementById('serviceAmountUsd');
    if (inp) inp.value = _currentAmountUsd;
  };

  let _activeCoupon = null;

  function injectCheckoutPanel() {
    if (!form || document.getElementById('serviceCheckoutPanel')) return;

    const panel = document.createElement('div');
    panel.id = 'serviceCheckoutPanel';
    panel.innerHTML = `
      <div class="service-checkout-box">
        <div class="service-checkout-head">
          <strong>Payment</strong>
          <div class="service-price-pill">
            <span id="servicePriceUsd">$0</span>
            <small id="servicePriceBdt">৳0</small>
          </div>
        </div>
        <input type="hidden" id="serviceAmountUsd" value="0" />
        <div class="coupon-row" id="couponRow">
          <button type="button" class="coupon-reveal" id="couponRevealBtn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
            Do you have a coupon?
          </button>
          <div class="coupon-input-wrap" id="couponInputWrap" style="display:none;">
            <input type="text" id="couponInput" placeholder="Coupon / Discount Code" autocomplete="off" spellcheck="false" />
            <button type="button" id="couponApplyBtn">Apply</button>
          </div>
          <div id="couponMsg" style="display:none;"></div>
        </div>
        <div class="service-pay-actions">
          <button type="button" id="buyWithCreditBtn" class="cx-pay">
            <span class="cx-pay-name">Balance Pay</span>
            <span class="cx-pay-desc">Wallet Balance</span>
          </button>
          <button type="button" id="instantPayBtn" class="cx-pay">
            <span class="cx-pay-name">Instant Pay</span>
            <span class="cx-pay-desc">Local Gateway</span>
          </button>
        </div>
        <p class="service-pay-note"><a href="/delivery-policy/">Delivery Policy</a> · <a href="/refund-policy/">Refund Policy</a></p>
      </div>
    `;

    if (submitBtn) {
      submitBtn.style.display = 'none';
      form.insertBefore(panel, submitBtn);
    } else {
      form.appendChild(panel);
    }

    const style = document.createElement('style');
    style.textContent = `
      .service-checkout-box { background:rgba(255, 255, 255,.055); border:1px solid rgba(255, 255, 255,.18); border-radius:18px; padding:18px; margin:22px 0 6px; }
      .service-checkout-head { display:flex; justify-content:space-between; gap:14px; align-items:center; margin-bottom:14px; }
      .service-checkout-head strong { display:block; color:#f7f7f4; font-size:1rem; margin-bottom:4px; }
      .service-checkout-head span { color:#aaaaaa; font-size:.84rem; line-height:1.55; }
      .service-price-pill { text-align:right; background:none; border:none; border-radius:0; padding:0; min-width:0; box-shadow:none; }
      .service-price-pill span { display:none; }
      .service-price-pill small { display:block; color:#f5f5f3; font-weight:800; font-size:1.05rem; }
      .service-pay-actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      .service-pay-actions .cx-pay { display:flex; flex-direction:column; align-items:flex-start; gap:2px; width:100%; text-align:left; border:1.5px solid rgba(255,255,255,.34); background:#161616; border-radius:12px; padding:10px 12px; cursor:pointer; transition:border-color .15s, background .15s; position:relative; color:#f5f5f3; }
      .service-pay-actions .cx-pay:hover { border-color:rgba(255,255,255,.5); background:#1c1c1c; }
      .service-pay-actions .cx-pay.sel { border:2px solid #fff; background:#fff; color:#111; }
      .service-pay-actions .cx-pay.sel .cx-pay-name,
      .service-pay-actions .cx-pay.sel .cx-pay-desc { color:#111; }
      html[data-theme="dark"] .service-pay-actions .cx-pay.sel { background:#fff !important; color:#111 !important; border:2px solid #fff !important; }
      html[data-theme="dark"] .service-pay-actions .cx-pay.sel .cx-pay-name,
      html[data-theme="dark"] .service-pay-actions .cx-pay.sel .cx-pay-desc,
      html[data-theme="dark"] .service-pay-actions .cx-pay.sel span { color:#111 !important; opacity:1 !important; }
      .service-pay-actions .cx-pay.sel::after { content:""; position:absolute; top:10px; right:10px; width:16px; height:16px; border-radius:50%; background:#111; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 12.5 5 5L20 6.5'/%3E%3C/svg%3E"); background-size:10px; background-repeat:no-repeat; background-position:center; }
      .cx-pay-name { font-size:.82rem; font-weight:800; color:#f5f5f3; line-height:1.2; }
      .cx-pay-desc { font-size:.64rem; color:#a9a9a6; font-weight:600; line-height:1.3; }
      html[data-theme="light"] .service-pay-actions .cx-pay { background:#fff !important; color:#111 !important; border:1.5px solid #c4c4c0 !important; }
      html[data-theme="light"] #serviceCheckoutPanel #buyWithCreditBtn,
      html[data-theme="light"] #serviceCheckoutPanel #instantPayBtn,
      html[data-theme="light"] #serviceCheckoutPanel #buyWithCreditBtn.sel,
      html[data-theme="light"] #serviceCheckoutPanel #instantPayBtn.sel { background:#fff !important; color:#111 !important; border:1.5px solid #c4c4c0 !important; }
      html[data-theme="light"] #serviceCheckoutPanel #buyWithCreditBtn.sel,
      html[data-theme="light"] #serviceCheckoutPanel #instantPayBtn.sel { border:2.5px solid #111 !important; }
      html[data-theme="light"] #serviceCheckoutPanel #buyWithCreditBtn .cx-pay-name,
      html[data-theme="light"] #serviceCheckoutPanel #buyWithCreditBtn .cx-pay-desc,
      html[data-theme="light"] #serviceCheckoutPanel #instantPayBtn .cx-pay-name,
      html[data-theme="light"] #serviceCheckoutPanel #instantPayBtn .cx-pay-desc,
      html[data-theme="light"] #serviceCheckoutPanel #buyWithCreditBtn.sel .cx-pay-name,
      html[data-theme="light"] #serviceCheckoutPanel #buyWithCreditBtn.sel .cx-pay-desc { color:#111 !important; }
      html[data-theme="light"] .cx-pay-name,
      html[data-theme="light"] .service-pay-actions .cx-pay .cx-pay-name,
      html[data-theme="light"] .service-pay-actions .cx-pay.sel .cx-pay-name { color:#111 !important; }
      html[data-theme="light"] .cx-pay-desc,
      html[data-theme="light"] .service-pay-actions .cx-pay .cx-pay-desc,
      html[data-theme="light"] .service-pay-actions .cx-pay.sel .cx-pay-desc { color:#4a4a48 !important; }
      html[data-theme="light"] .service-pay-actions .cx-pay.sel { background:#fff !important; color:#111 !important; border:2.5px solid #111 !important; }
      html[data-theme="light"] .service-pay-actions .cx-pay.sel::after { background:#111 !important; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 12.5 5 5L20 6.5'/%3E%3C/svg%3E") !important; }
      html[data-theme="light"] #servicePriceBdt,
      html[data-theme="light"] .service-price-pill small { color:#111 !important; }
      .service-pay-actions button[disabled] { opacity:.6; cursor:not-allowed; }
      .coupon-reveal { display:flex; align-items:center; gap:8px; width:100%; background:transparent; border:none; color:#b4b4b1; font-size:.8rem; font-weight:700; cursor:pointer; padding:2px 0; font-family:inherit; text-align:left; }
      .coupon-reveal:hover { color:#fff; }
      .coupon-reveal svg { color:#8b8b87; }
      .service-pay-note { color:#8b8b87; font-size:.72rem; line-height:1.5; margin:10px 0 0; text-align:center; }
      .service-pay-note a { color:#b4b4b1; text-decoration:underline; text-underline-offset:2px; }
      .service-pay-note a:hover { color:#fff; }
      .coupon-row { margin-bottom:14px; }
      .coupon-input-wrap { display:flex; align-items:center; gap:8px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.10); border-radius:12px; padding:9px 12px; margin-top:8px; }
      #couponInput { flex:1; background:transparent; border:0; outline:none; color:#f7f7f4; font-size:.88rem; font-family:inherit; }
      #couponInput::placeholder { color:#70706d; }
      #couponApplyBtn { border:1px solid rgba(255, 255, 255,.30); background:rgba(255, 255, 255,.10); color:#e4e4e0; border-radius:8px; padding:6px 14px; font-weight:800; font-size:.8rem; cursor:pointer; white-space:nowrap; transition:.2s; }
      #couponApplyBtn:hover { background:rgba(255, 255, 255,.20); }
      #couponMsg { margin-top:8px; padding:8px 12px; border-radius:10px; font-size:.82rem; font-weight:700; }
      #couponMsg.success { background:rgba(255, 255, 255,.10); border:1px solid rgba(255, 255, 255,.25); color:#dfe9e0; }
      #couponMsg.error { background:rgba(255,80,80,.10); border:1px solid rgba(255,80,80,.22); color:#ffb0b0; }
    `;
    document.head.appendChild(style);

    // Balance / Instant Pay are selectors — clicking selects the method,
    // the "Pay Now" button (sticky bar) triggers the selected one.
    const creditBtn = document.getElementById('buyWithCreditBtn');
    const instantBtn = document.getElementById('instantPayBtn');
    let selectedPayMethod = 'balance';
    function selectPayMethod(m) {
      selectedPayMethod = m;
      if (creditBtn) creditBtn.classList.toggle('sel', m === 'balance');
      if (instantBtn) instantBtn.classList.toggle('sel', m === 'instant');
    }
    selectPayMethod('balance');
    if (creditBtn) creditBtn.addEventListener('click', function () { selectPayMethod('balance'); });
    if (instantBtn) instantBtn.addEventListener('click', function () { selectPayMethod('instant'); });
    window.rhPayNow = function () {
      if (selectedPayMethod === 'instant') handleInstantPay();
      else handleBuyWithCredit();
    };
    window.rhPayInstant = handleInstantPay;
    const couponRevealBtn = document.getElementById('couponRevealBtn');
    const couponInputWrap = document.getElementById('couponInputWrap');
    if (couponRevealBtn && couponInputWrap) {
      couponRevealBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        couponRevealBtn.style.display = 'none';
        couponInputWrap.style.display = 'flex';
        const ci = document.getElementById('couponInput');
        if (ci) ci.focus();
      });
      // Collapse back to "Do you have a coupon?" when clicking outside,
      // but only if no code has been typed yet.
      document.addEventListener('click', function (e) {
        if (couponInputWrap.style.display !== 'flex') return;
        if (couponInputWrap.contains(e.target)) return;
        const ci = document.getElementById('couponInput');
        if (ci && ci.value.trim() !== '') return;
        couponInputWrap.style.display = 'none';
        couponRevealBtn.style.display = '';
      });
    }
    const couponApplyBtn = document.getElementById('couponApplyBtn');
    if (couponApplyBtn) couponApplyBtn.addEventListener('click', applyCoupon);
    const couponInput = document.getElementById('couponInput');
    if (couponInput) couponInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } });
  }

  async function applyCoupon() {
    const input = document.getElementById('couponInput');
    const msg = document.getElementById('couponMsg');
    if (!input || !msg) return;
    const code = input.value.trim().toUpperCase();
    if (!code) { showCouponMsg('Please enter a coupon code.', 'error'); return; }
    const applyBtn = document.getElementById('couponApplyBtn');
    if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = '...'; }
    try {
      const { db: fsDb } = await import('./firebase-core.js');
      const { doc: fsDoc, getDoc: fsGetDoc } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
      const snap = await fsGetDoc(fsDoc(fsDb, 'coupons', code));
      if (!snap.exists()) { showCouponMsg('Invalid coupon code.', 'error'); _activeCoupon = null; refreshCouponPriceUI(); return; }
      const d = snap.data();
      if (d.active === false) { showCouponMsg('This coupon is no longer active.', 'error'); _activeCoupon = null; refreshCouponPriceUI(); return; }
      if (d.expiresAt && d.expiresAt.toMillis && d.expiresAt.toMillis() < Date.now()) { showCouponMsg('This coupon has expired.', 'error'); _activeCoupon = null; refreshCouponPriceUI(); return; }
      const dp = Number(d.discountPercent || 0);
      if (!dp || dp <= 0 || dp > 100) { showCouponMsg('Invalid coupon.', 'error'); _activeCoupon = null; refreshCouponPriceUI(); return; }
      _activeCoupon = { code, discountPercent: dp };
      refreshCouponPriceUI();
      showCouponMsg('Coupon applied! ' + dp + '% discount added.', 'success');
    } catch(err) {
      showCouponMsg('Could not validate coupon. Try again.', 'error');
      _activeCoupon = null; refreshCouponPriceUI();
    } finally {
      if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = 'Apply'; }
    }
  }

  function showCouponMsg(text, type) {
    const msg = document.getElementById('couponMsg');
    if (!msg) return;
    msg.textContent = text; msg.className = type; msg.style.display = 'block';
  }

  function refreshCouponPriceUI() {
    const base = _currentAmountUsd || 0;
    const final = _activeCoupon ? +(base * (1 - _activeCoupon.discountPercent / 100)).toFixed(2) : base;
    const priceUsdEl = document.getElementById('servicePriceUsd');
    const priceBdtEl = document.getElementById('servicePriceBdt');
    if (priceUsdEl) priceUsdEl.textContent = '$' + final.toFixed(2) + (_activeCoupon ? ' (-' + _activeCoupon.discountPercent + '%)' : '');
    if (priceBdtEl) priceBdtEl.textContent = '৳' + Math.round(final * 125).toLocaleString();
  }

  function getFinalAmountUsd() {
    const base = _currentAmountUsd || 0;
    if (!_activeCoupon) return base;
    return +(base * (1 - _activeCoupon.discountPercent / 100)).toFixed(2);
  }

  function setDefaultAmount(serviceName) {
    const fixed = FIXED_SERVICE_PRICES[serviceName];
    if (fixed && fixed > 0) {
      _currentAmountUsd = fixed;
    } else {
      _currentAmountUsd = 0; // dynamic (set by radio)
    }
    window.updateServiceAmountUI();
    const inp = document.getElementById('serviceAmountUsd');
    if (inp) inp.value = _currentAmountUsd;
  }

  function getServiceAmount() {
    return _currentAmountUsd;
  }

  function enrichFreeFireAutoTopupDetails(data) {
    if (activeFieldsType !== 'ff' || !form) return data;

    const selectedPackage = form.querySelector('input[name="ff_package"]:checked');
    const ffUid = document.getElementById('mo_ff_uid')?.value.trim() || '';

    if (selectedPackage) {
      const productId   = selectedPackage.dataset.productId   || selectedPackage.getAttribute('data-product-id')   || '';
      const variationId = selectedPackage.dataset.variationId || selectedPackage.getAttribute('data-variation-id') || productId;
      const i4gId       = selectedPackage.dataset.item4gamerProductId || selectedPackage.getAttribute('data-item4gamer-product-id') || variationId || productId;
      const isMembership = selectedPackage.dataset.isMembership === '1';
      const amountUsd   = parseFloat(selectedPackage.dataset.amountUsd || 0) || null;
      const amountBDT   = parseFloat(selectedPackage.dataset.amountBdt || 0) || null;
      const name        = selectedPackage.dataset.packageName || selectedPackage.value || '';
      const isItem4     = !!i4gId && (selectedPackage.dataset.provider === 'item4gamer' || !!variationId);

      data.provider            = isItem4 ? 'item4gamer' : 'fazercards';
      data.productId           = productId;
      data.product_id          = productId;
      data.variationId         = variationId;
      data.variation_id        = variationId;
      data.item4gamerProductId = i4gId;
      data.fazercardsProductId = productId;
      data.gameId              = 'freefire';
      data.game_id             = 'freefire';
      data.packageName         = name;
      data.productName         = name;
      data.isMembership        = isMembership;
      data.autoTopupReady      = !!productId;

      if (amountUsd !== null && amountUsd > 0) { data.amountUsd = amountUsd; data.amountUSD = amountUsd; }
      if (amountBDT !== null && amountBDT > 0) { data.amountBDT = amountBDT; data.amountBdt = amountBDT; }
    }

    if (ffUid) {
      data.freeFireUid = ffUid;
      data.uid         = ffUid;
      data.playerId    = ffUid;
      data.player_id   = ffUid;
      data.user_id     = ffUid;
    }

    if (window._i4gVerifiedName) data.playerName = window._i4gVerifiedName;

    if (typeof window._i4gCollectHook === 'function') window._i4gCollectHook(data);
    return data;
  }

  function collectFormData() {
    if (!form) return {};
    const data = {};
    new FormData(form).forEach((val, key) => {
      if (val !== null && String(val).trim() !== '') data[key] = String(val).trim();
    });
    data.service_type = activeServiceName;
    data._amount_usd = _currentAmountUsd;
    // Track which page/app the order came from
    data.source_page = (function() {
      const path = window.location.pathname.split('/').pop() || '/';
      const params = new URLSearchParams(window.location.search);
      const appId = params.get('app');
      if (appId) return path + '?app=' + appId;
      return path;
    })();
    enrichFreeFireAutoTopupDetails(data);
    return data;
  }

  function validateBasicDetails() {
    const isNoContact = NO_CONTACT_FIELDS.includes(activeFieldsType);

    if (!isNoContact) {
      const name = document.getElementById('mo_name')?.value.trim();
      const email = document.getElementById('mo_email')?.value.trim();
      if (!name || !email) {
        showStatus('Fill in your Name and Email.', 'error');
        return false;
      }
    }

    if (activeFieldsType === 'card') {
      const selectedCardType = document.querySelector('input[name="card_type"]:checked')?.value || '';
      const selectedCardPrice = document.getElementById('mo_card_price_usd')?.value
        || document.querySelector('input[name="card_price_package"]')?.value || '';
      if (!selectedCardType || !selectedCardPrice) {
        showStatus('Select card type and fixed price.', 'error');
        return false;
      }
    }

    if (activeFieldsType === 'ff') {
      const ffUid = document.getElementById('mo_ff_uid')?.value.trim();
      const selectedPackage = form?.querySelector('input[name="ff_package"]:checked');
      if (!selectedPackage) {
        showStatus('Select a Free Fire package first.', 'error');
        return false;
      }
      if (!ffUid) {
        showStatus('Enter your Free Fire UID.', 'error');
        return false;
      }
      // Player ID must be verified before submit
      if (!window._i4gPlayerVerified) {
        showStatus('First verify your UID with the Check button.', 'error');
        const checkBtn = document.getElementById('i4g-check-player-btn');
        if (checkBtn) { checkBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }); checkBtn.focus(); }
        return false;
      }
      if (window._i4gVerifiedUid && ffUid !== window._i4gVerifiedUid) {
        showStatus('UID has changed. Run "Check Player ID" again.', 'error');
        window._i4gPlayerVerified = false;
        return false;
      }
    }

    const amount = getServiceAmount();
    if (!amount || amount < 0.1) {
      showStatus('Select a package/variant first.', 'error');
      return false;
    }

    return true;
  }

  function waitForWalletFunction(timeoutMs = 1800) {
    return new Promise((resolve) => {
      if (window.buyServiceWithCredit) { resolve(true); return; }
      const started = Date.now();
      const timer = setInterval(() => {
        if (window.buyServiceWithCredit) { clearInterval(timer); resolve(true); }
        else if (Date.now() - started >= timeoutMs) { clearInterval(timer); resolve(false); }
      }, 100);
    });
  }

  async function sendToFormspree(extraData) {
    const data = { ...collectFormData(), ...(extraData || {}) };
    if (window.rabbiAuth && window.rabbiAuth.getUser()) {
      data._user_uid = window.rabbiAuth.getUser().uid;
      data._user_email = window.rabbiAuth.getUser().email;
    }
    try {
      await fetch(FORMSPREE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (err) { /* non-blocking */ }
  }

  /* ── Full-page overlay injection ── */
  function injectFullPageStyles() {
    if (document.getElementById('rhFullPageModalStyle')) return;
    const s = document.createElement('style');
    s.id = 'rhFullPageModalStyle';
    s.textContent = `
      .service-modal-overlay.open {
        display: flex !important;
        position: fixed !important;
        inset: 0 !important;
        z-index: 3000 !important;
        background: var(--bg, #080808) !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        align-items: flex-start !important;
        justify-content: center !important;
        padding: 0 !important;
        overflow-y: auto !important;
        animation: rhFpIn 0.28s cubic-bezier(0.4,0,0.2,1) both !important;
      }
      @keyframes rhFpIn {
        from { opacity: 0; transform: translateY(22px); }
        to   { opacity: 1; transform: none; }
      }
      .service-modal {
        width: 100% !important;
        max-width: 680px !important;
        max-height: none !important;
        min-height: 100vh !important;
        border-radius: 0 !important;
        border-left: none !important;
        border-right: none !important;
        border-top: none !important;
        padding: 0 0 120px !important;
        box-shadow: none !important;
        background: var(--bg, #080808) !important;
        animation: none !important;
      }
      #rhModalTopBar {
        position: sticky;
        top: 0;
        z-index: 10;
        background: rgba(2,10,16,0.96);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border-bottom: 1px solid rgba(255, 255, 255,0.12);
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 20px;
      }
      #rhModalBackBtn {
        display: flex;
        align-items: center;
        gap: 7px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 12px;
        color: #aaaaaa;
        font-size: 0.82rem;
        font-weight: 800;
        cursor: pointer;
        padding: 8px 14px;
        transition: background 0.18s, color 0.18s;
        flex-shrink: 0;
      }
      #rhModalBackBtn:hover { background: rgba(255, 255, 255,0.10); color: #ffffff; border-color: rgba(255, 255, 255,0.25); }
      #rhModalTopTitle {
        flex: 1;
        font-size: 0.92rem;
        font-weight: 900;
        color: #ededec;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #rhModalContentWrap {
        padding: 28px 20px 0;
        max-width: 640px;
        margin: 0 auto;
        width: 100%;
      }
      /* hide original close button */
      .service-modal-close { display: none !important; }
      /* hide original title/subtitle inside modal — shown in top bar */
      #modalTitle, #modalSubtitle { display: none !important; }

      @media(min-width: 700px) {
        .service-modal {
          border-radius: 0 !important;
          min-height: 100vh !important;
        }
        #rhModalContentWrap { padding: 36px 40px 0; }
      }
    `;
    document.head.appendChild(s);
  }

  function ensureTopBar(serviceName) {
    const modal = document.querySelector('.service-modal');
    if (!modal) return;

    let bar = document.getElementById('rhModalTopBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'rhModalTopBar';
      bar.innerHTML = `
        <button id="rhModalBackBtn" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back
        </button>
        <div id="rhModalTopTitle"></div>
      `;
      modal.insertBefore(bar, modal.firstChild);
      document.getElementById('rhModalBackBtn').addEventListener('click', closeModal);
    }

    const titleEl = document.getElementById('rhModalTopTitle');
    if (titleEl) titleEl.textContent = serviceName;

    // Wrap form content in padding container if not already
    let wrap = document.getElementById('rhModalContentWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'rhModalContentWrap';
      // Move all children except the top bar into wrap
      const children = Array.from(modal.childNodes).filter(n => n.id !== 'rhModalTopBar');
      children.forEach(c => wrap.appendChild(c));
      modal.appendChild(wrap);
    }
  }

  function openModal(serviceName, fieldsType) {
    if (!overlay || !form) return;

    injectFullPageStyles();
    injectCheckoutPanel();

    activeServiceName = serviceName;
    activeFieldsType = fieldsType || '';

    showFields(fieldsType || '');
    if (fieldsType === 'card') resetCardPricing();
    if (fieldsType === 'ff' && typeof window.ffSelectType === 'function') window.ffSelectType('diamond');
    showStatus('', '');

    form.style.display = 'block';
    const successScreen = document.getElementById('modalSuccess');
    if (successScreen) successScreen.style.display = 'none';
    form.reset();
    serviceInput.value = serviceName;
    setDefaultAmount(serviceName);

    // Pre-fill name/email if logged in (for non-FF services)
    if (window.rabbiAuth && window.rabbiAuth.getUser()) {
      const user = window.rabbiAuth.getUser();
      const nameInput = document.getElementById('mo_name');
      const emailInput = document.getElementById('mo_email');
      if (nameInput && !nameInput.value) nameInput.value = user.displayName || '';
      if (emailInput && !emailInput.value) emailInput.value = user.email || '';
    }

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    overlay.scrollTop = 0;

    // Inject top bar after overlay is visible
    requestAnimationFrame(() => ensureTopBar('Order: ' + serviceName));

    // Push history state so browser back button closes modal
    if (!window._rhModalHistoryPushed) {
      window._rhModalHistoryPushed = true;
      history.pushState({ rhModal: true }, '');
    }
  }

  function closeModal() {
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    window._rhModalHistoryPushed = false;
  }

  /* ── Inline mount for the dedicated checkout page (checkout.html) ─────────
     Same fields, same validation, same payment handlers — but rendered inline
     on a real page instead of a popup overlay. checkout.js calls this.       */
  window.rhMountCheckout = function (opts) {
    if (!form) return false;
    const o = opts || {};

    injectCheckoutPanel();

    activeServiceName = o.serviceName || 'Service';
    activeFieldsType = o.fieldsType || '';

    showFields(activeFieldsType);
    if (activeFieldsType === 'card') resetCardPricing();
    if (activeFieldsType === 'ff' && typeof window.ffSelectType === 'function') window.ffSelectType('diamond');
    showStatus('', '');

    form.style.display = 'block';
    const successScreen = document.getElementById('modalSuccess');
    if (successScreen) successScreen.style.display = 'none';
    if (serviceInput) serviceInput.value = activeServiceName;
    setDefaultAmount(activeServiceName);

    // Pre-fill contact details for the signed-in customer.
    if (window.rabbiAuth && window.rabbiAuth.getUser()) {
      const user = window.rabbiAuth.getUser();
      const nameInput = document.getElementById('mo_name');
      const emailInput = document.getElementById('mo_email');
      if (nameInput && !nameInput.value) nameInput.value = user.displayName || '';
      if (emailInput && !emailInput.value) emailInput.value = user.email || '';
    }

    // Auto-select the requested premium app.
    if (o.proapp) {
      const trySelect = function (n) {
        if (typeof window._proappSelect === 'function') window._proappSelect(o.proapp);
        else if (n > 0) setTimeout(function () { trySelect(n - 1); }, 200);
      };
      setTimeout(function () { trySelect(12); }, 250);
    }

    if (typeof window.updateServiceAmountUI === 'function') window.updateServiceAmountUI();
    return true;
  };

  // Browser back button support
  window.addEventListener('popstate', function(e) {
    if (overlay && overlay.classList.contains('open')) {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
      window._rhModalHistoryPushed = false;
    }
  });

  /* ── iOS Panel Key Delivery ── */
  function _injectIosAnimStyles() {
    if (document.getElementById('iosAnimStyle')) return;
    const s = document.createElement('style');
    s.id = 'iosAnimStyle';
    s.textContent = `
      @keyframes iosPopIn{from{opacity:0;transform:scale(.85) translateY(28px)}to{opacity:1;transform:none}}
      @keyframes iosReveal{from{opacity:0;transform:scale(.90) translateY(20px)}to{opacity:1;transform:none}}
      @keyframes iosSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      @keyframes iosPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
      @keyframes iosDot{0%,80%,100%{transform:scale(.5);opacity:.3}40%{transform:scale(1);opacity:1}}
      @keyframes iosSuccessPop{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
      @keyframes iosCheckDraw{to{stroke-dashoffset:0}}
      @keyframes iosKeySlide{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
    `;
    document.head.appendChild(s);
  }

  function showIosProcessingModal() {
    const overlay = document.getElementById('serviceModal');
    if (overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; }
    _injectIosAnimStyles();

    let ov = document.getElementById('orderPlacedOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'orderPlacedOverlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.88);backdrop-filter:blur(16px);padding:20px;';
      document.body.appendChild(ov);
    }

    ov.innerHTML = `
      <div style="width:min(420px,100%);border-radius:28px;padding:44px 28px 36px;text-align:center;
        background:linear-gradient(180deg,rgba(255, 255, 255,.10) 0%,rgba(0,10,30,.95) 100%);
        border:1px solid rgba(255, 255, 255,.25);
        box-shadow:0 40px 100px rgba(0,0,0,.7),0 0 80px rgba(255, 255, 255,.08);
        animation:iosPopIn .45s cubic-bezier(.2,1,.2,1) both;">

        <div style="position:relative;width:90px;height:90px;margin:0 auto 24px;">
          <svg style="position:absolute;inset:0;animation:iosSpin 1.4s linear infinite;" width="90" height="90" viewBox="0 0 90 90">
            <circle cx="45" cy="45" r="40" fill="none" stroke="rgba(255, 255, 255,.15)" stroke-width="4"/>
            <circle cx="45" cy="45" r="40" fill="none" stroke="url(#iosSpinGrad)" stroke-width="4"
              stroke-linecap="round" stroke-dasharray="80 172" stroke-dashoffset="0"/>
            <defs>
              <linearGradient id="iosSpinGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#ffffff"/>
                <stop offset="100%" stop-color="#ffffff"/>
              </linearGradient>
            </defs>
          </svg>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>
            </svg>
          </div>
        </div>

        <div style="display:inline-flex;align-items:center;gap:7px;padding:5px 14px;border-radius:999px;
          background:rgba(255, 255, 255,.10);border:1px solid rgba(255, 255, 255,.22);
          color:#c4c4c1;font-size:.7rem;font-weight:900;letter-spacing:.07em;text-transform:uppercase;margin-bottom:16px;">
          <span style="width:7px;height:7px;border-radius:50%;background:#ffffff;animation:iosPulse 1s ease-in-out infinite;display:inline-block;"></span>
          Processing
        </div>

        <h2 style="font-size:1.4rem;color:#f8f8f7;margin:0 0 10px;font-weight:800;">Generating your key…</h2>
        <p style="color:#7e7e79;font-size:.88rem;margin:0 0 28px;line-height:1.6;">Please wait a moment.<br>Do not close this page.</p>

        <div style="display:flex;gap:6px;justify-content:center;margin-bottom:8px;">
          <span style="width:8px;height:8px;border-radius:50%;background:#ffffff;animation:iosDot 1.2s ease-in-out infinite;"></span>
          <span style="width:8px;height:8px;border-radius:50%;background:#ffffff;animation:iosDot 1.2s ease-in-out infinite .2s;"></span>
          <span style="width:8px;height:8px;border-radius:50%;background:#ffffff;animation:iosDot 1.2s ease-in-out infinite .4s;"></span>
        </div>
      </div>
    `;
  }

  function showIosKeyModal(key, amountUsd, errorMsg) {
    _injectIosAnimStyles();

    let ov = document.getElementById('orderPlacedOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'orderPlacedOverlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.88);backdrop-filter:blur(16px);padding:20px;';
      document.body.appendChild(ov);
    }

    const usdStr = amountUsd ? `$${Number(amountUsd).toFixed(2)}` : '';
    const safeKey = (key || '').replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$/g,'\\$').replace(/'/g,"\\'");

    ov.innerHTML = `
      <div style="width:min(440px,100%);border-radius:28px;padding:36px 28px 28px;text-align:center;
        background:linear-gradient(180deg,rgba(255, 255, 255,.12) 0%,rgba(0,10,30,.97) 100%);
        border:1px solid rgba(255, 255, 255,.35);
        box-shadow:0 40px 100px rgba(0,0,0,.7),0 0 80px rgba(255, 255, 255,.12);
        animation:iosReveal .55s cubic-bezier(.2,1,.2,1) both;">

        ${!errorMsg ? `
          <div style="position:relative;width:80px;height:80px;margin:0 auto 18px;">
            <div style="width:80px;height:80px;border-radius:50%;
              background:linear-gradient(135deg,rgba(255, 255, 255,.18),rgba(255, 255, 255,.12));
              border:1.5px solid rgba(255, 255, 255,.4);
              display:flex;align-items:center;justify-content:center;
              animation:iosSuccessPop .6s cubic-bezier(.2,1.4,.3,1) both .1s;">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:iosCheckDraw .5s ease both .3s;stroke-dasharray:30;stroke-dashoffset:30;">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            </div>
          </div>
        ` : `
          <div style="width:80px;height:80px;border-radius:50%;margin:0 auto 18px;
            background:rgba(255,80,80,.10);border:1.5px solid rgba(255,80,80,.35);
            display:flex;align-items:center;justify-content:center;">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" stroke-width="1.8" stroke-linecap="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
          </div>
        `}

        <div style="display:inline-flex;align-items:center;gap:8px;padding:5px 14px;border-radius:999px;
          background:${errorMsg ? 'rgba(255,80,80,.10)' : 'rgba(255, 255, 255,.10)'};
          border:1px solid ${errorMsg ? 'rgba(255,80,80,.28)' : 'rgba(255, 255, 255,.28)'};
          color:${errorMsg ? '#ffb0b0' : '#dfe9e0'};
          font-size:.7rem;font-weight:900;letter-spacing:.07em;text-transform:uppercase;margin-bottom:14px;">
          ${errorMsg ? 'Order Failed' : 'iOS Panel — Key Delivered ✓'}
        </div>

        <h2 style="font-size:1.45rem;color:#f8f8f7;margin:0 0 8px;font-weight:800;">
          ${errorMsg ? 'Something went wrong' : 'Order Successful ! 🎉'}
        </h2>

        ${errorMsg ? `
          <div style="background:rgba(255,80,80,.08);border:1px solid rgba(255,80,80,.20);border-radius:14px;
            padding:14px;color:#ffb0b0;font-size:.88rem;margin:14px 0 22px;line-height:1.6;">
            ${errorMsg}
          </div>
        ` : `
          <p style="color:#7e7e79;font-size:.86rem;margin:0 0 20px;">Copy and save the key below.</p>

          <div style="background:rgba(0,0,0,.45);border:1px solid rgba(255, 255, 255,.22);border-radius:18px;
            padding:20px 18px 14px;margin:0 0 14px;position:relative;text-align:left;
            animation:iosKeySlide .5s cubic-bezier(.2,1,.2,1) both .2s;">
            <div style="font-size:.65rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
              color:#555552;margin-bottom:10px;">YOUR KEY</div>
            <div id="iosDeliveredKey" style="font-family:'Courier New',monospace;font-size:1rem;
              color:#858580;letter-spacing:.06em;word-break:break-all;line-height:1.7;
              user-select:all;padding-right:4px;">
              ${key}
            </div>
          </div>

          <button id="iosCopyBtn" type="button"
            style="width:100%;border:none;border-radius:16px;padding:15px;cursor:pointer;
            background:linear-gradient(135deg,#ffffff 0%,#ffffff 100%);
            color:#080808;font-weight:900;font-size:1rem;
            margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:9px;
            box-shadow:0 8px 32px rgba(255, 255, 255,.25);
            transition:transform .15s,box-shadow .15s;
            animation:iosKeySlide .5s cubic-bezier(.2,1,.2,1) both .3s;"
            onmousedown="this.style.transform='scale(.97)'"
            onmouseup="this.style.transform=''"
            onmouseleave="this.style.transform=''">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy Key
          </button>

          <div style="background:rgba(255,166,0,.07);border:1px solid rgba(255,166,0,.18);border-radius:12px;
            padding:10px 14px;color:#c8a04a;font-size:.78rem;margin-bottom:18px;text-align:left;
            display:flex;align-items:flex-start;gap:8px;line-height:1.5;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="flex-shrink:0;margin-top:2px;"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
            Save this key now. You can view it again in My Orders if you close this page.
          </div>
        `}

        ${usdStr ? `<div style="margin-bottom:14px;"><span style="padding:7px 16px;border-radius:999px;background:rgba(255, 255, 255,.08);border:1px solid rgba(255, 255, 255,.18);color:#8d8d88;font-weight:800;font-size:.84rem;">${usdStr}</span></div>` : ''}

        <button type="button" onclick="window.location.href='/dashboard/?tab=orders'"
          style="width:100%;border:none;border-radius:14px;padding:14px;
          background:#ffffff;color:#080808;font-weight:900;font-size:.95rem;cursor:pointer;margin-bottom:10px;
          box-shadow:0 6px 24px rgba(255, 255, 255,.20);">
          View My Orders
        </button>

        ${!errorMsg ? `
        <button id="iosRateBtn" type="button"
          style="width:100%;border:1px solid rgba(255,165,0,.25);border-radius:14px;padding:12px;
          background:rgba(255,165,0,.07);color:#c8922a;font-weight:800;font-size:.88rem;cursor:pointer;
          display:flex;align-items:center;justify-content:center;gap:8px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="#f5a623" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Rate Your Experience
        </button>` : ''}
      </div>
    `;

    // Copy button logic
    const copyBtn = document.getElementById('iosCopyBtn');
    if (copyBtn && key) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(key).then(() => {
          copyBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg> Copied!`;
          copyBtn.style.background = '#ffffff';
          copyBtn.style.boxShadow = '0 8px 32px rgba(255, 255, 255,.3)';
          setTimeout(() => {
            copyBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Key`;
            copyBtn.style.background = 'linear-gradient(135deg,#ffffff 0%,#ffffff 100%)';
            copyBtn.style.boxShadow = '0 8px 32px rgba(255, 255, 255,.25)';
          }, 2200);
        }).catch(() => {
          const el = document.getElementById('iosDeliveredKey');
          if (el) { const r = document.createRange(); r.selectNode(el); window.getSelection().removeAllRanges(); window.getSelection().addRange(r); }
        });
      });
    }

    // Rate button — open review modal
    const iosRateBtn = document.getElementById('iosRateBtn');
    if (iosRateBtn) {
      iosRateBtn.addEventListener('click', () => {
        const ov2 = document.getElementById('orderPlacedOverlay');
        if (ov2) ov2.remove();
        if (typeof window.openReviewModal === 'function') {
          window.openReviewModal('Free Fire iPhone Panel (iOS)');
        }
      });
    }
  }

  async function handleBuyWithCredit() {
    if (!window.rabbiAuth || !window.rabbiAuth.isLoggedIn()) {
      window.rabbiAuth && window.rabbiAuth.openLogin('apply');
      window._pendingService = { service: activeServiceName, fields: activeFieldsType };
      return;
    }

    if (!validateBasicDetails()) return;

    const amountUsd = getFinalAmountUsd();
    const baseAmountUsd = getServiceAmount();

    // ── Balance check BEFORE placing order ──────────────────────────
    if (!baseAmountUsd || baseAmountUsd <= 0) {
      showStatus('Could not find a valid service price. Try again.', 'error');
      return;
    }

    // Wait up to 2s for credit value to be available from Firestore
    let currentCredit = null;
    for (let i = 0; i < 20; i++) {
      const val = window.rabbiAuth && typeof window.rabbiAuth.getCredit === 'function'
        ? window.rabbiAuth.getCredit()
        : null;
      if (val !== null && val !== undefined) { currentCredit = val; break; }
      await new Promise(r => setTimeout(r, 100));
    }

    if (currentCredit === null) {
      // Balance still loading — do NOT redirect, just show error
      showStatus('Balance could not load. Wait a moment and try again.', 'error');
      return;
    }

    if (currentCredit < amountUsd) {
      // Insufficient balance — Instant Pay covers this order directly, so
      // offer that instead of forcing a wallet top-up first.
      showStatus(`Balance is low ($${currentCredit.toFixed(2)} / $${amountUsd.toFixed(2)}) — use Instant Pay instead.`, 'error');
      const ip = document.getElementById('instantPayBtn');
      if (ip) {
        ip.scrollIntoView({ behavior: 'smooth', block: 'center' });
        ip.style.transition = 'box-shadow .3s ease';
        ip.style.boxShadow = '0 0 0 3px rgba(255,255,255,.35)';
        setTimeout(() => { ip.style.boxShadow = 'none'; }, 2200);
      }
      return;
    }
    // ────────────────────────────────────────────────────────────────

    const btn = document.getElementById('buyWithCreditBtn');
    const old = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="vertical-align:-3px;margin-right:6px;animation:spin .7s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Processing…'; }

    const details = collectFormData();
    // Attach coupon info to details so it's saved in order
    if (_activeCoupon) {
      details.couponCode = _activeCoupon.code;
      details.discountPercent = _activeCoupon.discountPercent;
      details.originalAmountUsd = baseAmountUsd;
    }

    // Call backend first — only show success if backend confirms.
    // iOS key inventory is server-side; the browser never downloads a key pool.
    const result = activeFieldsType === 'ffIos'
      ? await buyIosPanelWithCreditDirect(amountUsd)
      : await buyServiceWithCreditDirect({ serviceName: activeServiceName, fieldsType: activeFieldsType, amountUsd, baseAmountUsd: baseAmountUsd, details });

    if (!result.ok) {
      if (btn) { btn.disabled = false; btn.innerHTML = old || 'Pay with Credit'; }
      if (result.reason === 'insufficient') {
        showStatus('Insufficient balance. Please add credit.', 'error');
        setTimeout(() => { window.location.href = '/add-credit/'; }, 1200);
      } else if (result.reason === 'login') {
        showStatus('Please login first.', 'error');
        window.rabbiAuth && window.rabbiAuth.openLogin('apply');
      } else {
        showStatus(result.message || 'Order failed. Please try again.', 'error');
      }
      return;
    }

    // Backend confirmed — iOS keys are returned one-at-a-time by the protected backend.
    if (activeFieldsType === 'ffIos') {
      if (result.variant === 'setup') {
        showServiceSuccess(result, result.amountUsd || amountUsd);
        sendToFormspree({ _payment_method: 'credit', _payment_status: 'paid_ios_setup_pending', _amount_usd: result.amountUsd || amountUsd }).catch(() => {});
      } else {
        showIosKeyModal(result.key, result.amountUsd || amountUsd, result.key ? null : 'Key delivery pending. Please contact support.');
        sendToFormspree({ _payment_method: 'credit', _payment_status: 'paid_ios_key_delivered', _amount_usd: result.amountUsd || amountUsd }).catch(() => {});
      }
      return;
    }

    // Backend confirmed — now show success
    showServiceSuccess(result, amountUsd);
    sendToFormspree({ _payment_method: 'credit', _payment_status: 'paid_credit_pending_review', _amount_usd: amountUsd, _amount_bdt: Math.round(amountUsd * 125) }).catch(() => {});
  }

  /**
   * Instant Pay — pay for THIS order directly through SPV
   * (bKash / Nagad / Rocket), without topping the wallet up first.
   *
   * Flow: validate -> stash the order -> ask our backend for an SPV intent ->
   * send the customer to SPV's hosted checkout. When SPV verifies, the backend
   * credits the amount and the stashed order is placed automatically on return
   * (see resumePaidServiceOrder below).
   */
  async function handleInstantPay() {
    if (!window.rabbiAuth || !window.rabbiAuth.isLoggedIn()) {
      window.rabbiAuth && window.rabbiAuth.openLogin('apply');
      window._pendingService = { service: activeServiceName, fields: activeFieldsType };
      return;
    }

    if (!validateBasicDetails()) return;

    const amountUsd = getServiceAmount();
    if (!amountUsd || amountUsd < 1) {
      showStatus('Instant Pay requires a minimum of $1. Use balance for smaller amounts.', 'error');
      return;
    }

    const details = collectFormData();
    if (_activeCoupon) {
      details.couponCode = _activeCoupon.code;
      details.discountPercent = _activeCoupon.discountPercent;
    }

    const btn = document.getElementById('instantPayBtn');
    const old = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="vertical-align:-3px;margin-right:6px;animation:spin .7s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Processing…';
    }

    // Stash the full order so it can be placed automatically once SPV verifies.
    try {
      sessionStorage.setItem('pendingServicePayment', JSON.stringify({
        serviceName: activeServiceName,
        fieldsType: activeFieldsType,
        amountUsd,
        details,
        createdAt: new Date().toISOString()
      }));
    } catch (e) {}

    try {
      showStatus('Creating Checkpoint…', 'info');
      const data = await backendPostRaw('/api/payment/spv/create-intent', { amountUsd });
      if (!data || !data.checkoutUrl) throw new Error('NO_CHECKOUT_URL');

      // Remember which top-up pays for this order.
      try {
        const raw = sessionStorage.getItem('pendingServicePayment');
        const rec = raw ? JSON.parse(raw) : {};
        rec.topupId = data.topupId;
        rec.paymentId = data.paymentId;
        sessionStorage.setItem('pendingServicePayment', JSON.stringify(rec));
        sessionStorage.setItem('spvPendingIntent', JSON.stringify({
          topupId: data.topupId, paymentId: data.paymentId, amountUsd, ts: Date.now()
        }));
      } catch (e) {}

      window.location.href = data.checkoutUrl;
    } catch (err) {
      if (btn) { btn.disabled = false; btn.innerHTML = old; }
      const code = err && err.code ? err.code : '';
      if (code === 'SPV_NOT_CONFIGURED') {
        showStatus('Instant Pay is not available yet. Pay with balance or try again later.', 'error');
      } else if (code === 'NOT_LOGGED_IN' || code === 'AUTH_TOKEN_NOT_AVAILABLE') {
        showStatus('Login session expired — please sign in again.', 'error');
        window.rabbiAuth && window.rabbiAuth.openLogin('apply');
      } else if (code === 'INVALID_AMOUNT') {
        showStatus('Invalid amount. Please select a package again.', 'error');
      } else {
        showStatus('Could not start payment. Please try again later.', 'error');
        console.error('[InstantPay]', err && err.message ? err.message : err);
      }
    }
  }

  /**
   * After an SPV Instant Pay round-trip the customer lands back on our site
   * with credit already added by the backend. Place the stashed order now so
   * the payment and the order stay a single step for the user.
   */
  async function resumePaidServiceOrder() {
    let rec = null;
    try {
      const raw = sessionStorage.getItem('pendingServicePayment');
      if (!raw) return;
      rec = JSON.parse(raw);
    } catch (e) { return; }
    if (!rec || !rec.topupId || !rec.serviceName) return;

    // Only resume for a short window, and only once.
    if (rec.createdAt && (Date.now() - new Date(rec.createdAt).getTime()) > 60 * 60 * 1000) {
      try { sessionStorage.removeItem('pendingServicePayment'); } catch (e) {}
      return;
    }
    if (!window.rabbiAuth || !window.rabbiAuth.isLoggedIn()) return;

    try {
      const status = await backendPostRaw('/api/payment/spv/status?topupId=' + encodeURIComponent(rec.topupId), null, 'GET')
        .catch(() => null);
      // Backend replies { topupStatus, spvStatus, credited }.
      const topupStatus = status && (status.topupStatus || status.status);
      const verified = !!status && (topupStatus === 'approved' || status.spvStatus === 'verified' || status.credited === true);
      if (!verified) return;

      try { sessionStorage.removeItem('pendingServicePayment'); } catch (e) {}

      const result = rec.fieldsType === 'ffIos'
        ? await buyIosPanelWithCreditDirect(rec.amountUsd)
        : await buyServiceWithCreditDirect({
            serviceName: rec.serviceName,
            fieldsType: rec.fieldsType,
            amountUsd: rec.amountUsd,
            baseAmountUsd: rec.amountUsd,
            details: rec.details || {}
          });

      if (result && result.ok) {
        sendToFormspree({
          _payment_method: 'spv_instant',
          _payment_status: 'paid_instant_pending_review',
          _amount_usd: rec.amountUsd
        }).catch(() => {});
        if (rec.fieldsType === 'ffIos' && result.key) {
          showIosKeyModal(result.key, result.amountUsd || rec.amountUsd, null);
        } else {
          showServiceSuccess(result, rec.amountUsd);
        }
      }
    } catch (err) {
      console.error('[InstantPay resume]', err && err.message ? err.message : err);
    }
  }

  // Run the resume check once auth is ready (SPV returns to add-credit.html,
  // which then routes to the dashboard — this catches both landings).
  window.addEventListener('rabbi:loggedin', function () { setTimeout(resumePaidServiceOrder, 900); });
  setTimeout(function () {
    if (window.rabbiAuth && window.rabbiAuth.isLoggedIn && window.rabbiAuth.isLoggedIn()) resumePaidServiceOrder();
  }, 2200);

  // ── Info button ("What is this?") click handler for services.html ──────────
  document.querySelectorAll('.svc-info-btn[data-info-key]').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const key = this.dataset.infoKey;
      const applyField = this.dataset.applyField || '';
      const applyProapp = this.dataset.applyProapp || '';
      if (!key || typeof window.openServiceInfo !== 'function') return;
      window.openServiceInfo(key, function () {
        if (applyProapp) {
          const trigger = document.querySelector('[data-service][data-proapp="' + applyProapp + '"]');
          if (trigger) { trigger.click(); return; }
        }
        const trigger = document.querySelector('[data-fields="' + applyField + '"]:not(.svc-info-btn)');
        if (trigger) trigger.click();
      });
    });
  });
  // ────────────────────────────────────────────────────────────────────────────

  /* ── Slug map: service signature -> shareable checkout slug ───────────── */
  const CHECKOUT_SLUGS = {
    'Visa / Mastercard|card': 'visa-mastercard',
    'Facebook Meta Verified|meta': 'meta-verified',
    'Free Fire Diamond Top-up|ff': 'free-fire-topup',
    'Free Fire Android Panel Drip Client (Root)|ffDrip': 'ff-drip',
    'Free Fire Android Panel (FF4X)|ffFf4x': 'ff-ff4x',
    'Free Fire iPhone Panel (iOS)|ffIos': 'ff-ios',
    'Free Fire PC Panel|ffPc': 'ff-pc',
    'BR Mods|ffBrMods': 'br-mods',
    'Ethical Hacking / Security Audit|security': 'ethical-hacking',
    'Android App Development|android': 'android-development',
    'Website Development|webDev': 'web-development',
    'Digital Branding|': 'digital-branding',
    'Premium Digital Services|': 'premium-services'
  };

  // Every path that opens a service must land in a NEW tab — the checkout is a
  // standalone page and the customer should keep the catalogue they were on.
  window.rhOpenCheckout = function (slug) {
    if (!slug) return false;
    const url = '/checkout/?service=' + encodeURIComponent(slug);
    // Already on the standalone checkout — swap in place, don't spawn tabs.
    if (document.body.classList.contains('checkout-standalone')) {
      window.location.href = url;
      return true;
    }
    const win = window.open(url, '_blank', 'noopener');
    if (!win) window.location.href = url;   // popup blocked -> same tab
    return true;
  };

  function checkoutSlugFor(service, fields, proapp) {
    if (proapp) return proapp;                       // premium apps use the app id
    return CHECKOUT_SLUGS[service + '|' + (fields || '')] || '';
  }

  /* Order buttons now navigate to the dedicated, shareable checkout page
     instead of opening a popup. On checkout.html itself the form is already
     mounted inline, so these buttons are not present.                       */
  document.querySelectorAll('.service-apply-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const service = this.dataset.service || 'Service';
      const fields = this.dataset.fields || '';
      const proapp = this.dataset.proapp || '';

      const slug = checkoutSlugFor(service, fields, proapp);
      if (slug) { window.rhOpenCheckout(slug); return; }

      // Unknown service — fall back to the legacy inline overlay.
      openModal(service, fields);
      if (proapp) {
        const trySelect = (n) => {
          if (typeof window._proappSelect === 'function') {
            window._proappSelect(proapp);
          } else if (n > 0) {
            setTimeout(() => trySelect(n - 1), 200);
          }
        };
        setTimeout(() => trySelect(10), 350);
      }
    });
  });

  window.addEventListener('rabbi:loggedin', function () {
    if (window._pendingService) {
      const { service, fields } = window._pendingService;
      window._pendingService = null;
      openModal(service, fields);
    }
  });

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  function injectSuccessScreen() {
    if (document.getElementById('modalSuccess') || !form) return;
    const div = document.createElement('div');
    div.id = 'modalSuccess';
    div.style.cssText = 'display:none;text-align:center;padding:20px 10px 10px;';
    div.innerHTML = `
      <div style="width:72px;height:72px;background:rgba(255, 255, 255,0.1);border:2px solid rgba(255, 255, 255,0.3);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;color:#ffffff;"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <h3 style="font-family:var(--font-display);font-size:1.3rem;color:var(--text-primary);margin-bottom:10px;">Request Submitted!</h3>
      <p style="color:var(--text-secondary);font-size:0.9rem;line-height:1.7;margin-bottom:8px;">Your service request/payment has been saved successfully.<br/>Admin review pending.</p>
      <p style="color:var(--text-muted);font-size:0.78rem;margin-bottom:28px;">I will contact you soon.</p>
      <button onclick="document.getElementById('serviceModal').classList.remove('open');document.body.style.overflow='';" style="padding:11px 32px;background:var(--accent);color:#080808;border:none;border-radius:50px;font-family:var(--font-display);font-weight:700;font-size:0.88rem;cursor:pointer;">Close</button>
    `;
    form.parentNode.insertBefore(div, form.nextSibling);
  }
  injectSuccessScreen();

  function openServiceFromQuery() {
    // On checkout.html the form is mounted inline by checkout.js — never here.
    if (document.body.classList.contains('checkout-page')) return;

    const params = new URLSearchParams(window.location.search);
    const service = params.get('service');
    if (!service) return;
    const fields = params.get('fields') || '';
    const appId = params.get('app') || '';

    // Legacy deep links (?service=…&fields=…&app=…) now resolve to the real,
    // shareable checkout page instead of popping a modal open.
    const legacySlug = checkoutSlugFor(decodeURIComponent(service), decodeURIComponent(fields), decodeURIComponent(appId));
    if (legacySlug) {
      window.location.replace('/checkout/?service=' + encodeURIComponent(legacySlug));
      return;
    }

    setTimeout(() => {
      openModal(decodeURIComponent(service), decodeURIComponent(fields));
      const modal = document.getElementById('serviceModal');
      if (modal) modal.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Auto-select premium app — wait for modal DOM + renderApps() to complete
      if (appId) {
        const trySelect = (attempts) => {
          if (typeof window._proappSelect === 'function') {
            window._proappSelect(decodeURIComponent(appId));
          } else if (attempts > 0) {
            setTimeout(() => trySelect(attempts - 1), 200);
          }
        };
        setTimeout(() => trySelect(10), 300);
      }
    }, 150);
  }
  openServiceFromQuery();

  // Expose globally so index.html and other pages can open the modal
  window.openServiceModal = openModal;
  window.rhCollectFormData = collectFormData;
  window.rhGetServiceAmount = getServiceAmount;
  window.rhActiveService = function () { return { name: activeServiceName, fields: activeFieldsType }; };

  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      showStatus('Please fill in all required fields and click Place Order.', 'error');
      return;

      const data = collectFormData();
      if (window.rabbiAuth && window.rabbiAuth.getUser()) {
        data._user_uid = window.rabbiAuth.getUser().uid;
        data._user_email = window.rabbiAuth.getUser().email;
      }
      data._payment_status = 'request_only_no_payment_selected';

      try {
        const res = await fetch(FORMSPREE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data)
        });
        const json = await res.json();

        if (res.ok) {
          form.style.display = 'none';
          const successScreen = document.getElementById('modalSuccess');
          if (successScreen) successScreen.style.display = 'block';
        } else {
          const err = json.errors ? json.errors.map(e => e.message).join(', ') : 'Something went wrong.';
          showStatus(err, 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Submit Request <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>';
        }
      } catch (err) {
        showStatus('Network error. Please try again.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit Request';
      }
    });
  }
})();
