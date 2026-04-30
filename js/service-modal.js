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

  async function backendPost(path, payload) {
    if (!window.rabbiAuth || !window.rabbiAuth.isLoggedIn() || !window.rabbiAuth.getUser()) {
      throw new Error('NOT_LOGGED_IN');
    }

    const user = window.rabbiAuth.getUser();
    if (!user || typeof user.getIdToken !== 'function') {
      throw new Error('AUTH_TOKEN_NOT_AVAILABLE');
    }

    const token = await user.getIdToken(true);
    console.log('[ServiceModal] Calling backend:', path, payload);

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

  async function buyServiceWithCreditDirect(servicePayload) {
    const amountUsd = Number(servicePayload.amountUsd || 0);
    if (!amountUsd || amountUsd <= 0) {
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
      console.error('[ServiceModal] Direct backend buy failed:', error);
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
    'Premium App & Subscription': 5,
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
  const NO_CONTACT_FIELDS = ['ff','ffDrip','ffFf4x','ffIos','ffPc'];

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
    ffPc: 'ffPcFields'
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
        background:radial-gradient(circle,rgba(0,255,136,.22),rgba(0,200,255,.10));
        border:1px solid rgba(0,255,136,.32);
        box-shadow:0 0 40px rgba(0,255,136,.28);
        margin-bottom:22px;
        position:relative;
      }
      .service-success-ring:before{
        content:"";position:absolute;inset:-10px;border-radius:50%;
        border:1px solid rgba(0,200,255,.24);
        animation:svcPulse 1.2s ease-out infinite;
      }
      .service-success-ring svg{width:44px;height:44px;color:#00ff88;stroke-dasharray:60;stroke-dashoffset:60;animation:svcDraw .55s ease .15s forwards;}
      .service-success-animation h3{
        font-family:var(--font-display);font-size:1.55rem;color:#eaf3ff;margin:0 0 8px;
      }
      .service-success-animation p{
        color:#8ea5c1;line-height:1.7;max-width:420px;margin:0 auto 18px;
      }
      .service-success-badges{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;}
      .service-success-badges span{
        padding:7px 11px;border-radius:999px;background:rgba(0,200,255,.08);
        border:1px solid rgba(0,200,255,.18);color:#9edfff;font-size:.78rem;font-weight:900;
      }
      .service-success-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px;}
      .service-success-actions a,.service-success-actions button{
        border:0;text-decoration:none;cursor:pointer;border-radius:999px;padding:11px 16px;
        font-weight:900;font-family:inherit;
      }
      .service-success-actions a{background:linear-gradient(135deg,#00c8ff,#00ff88);color:#02050a;}
      .service-success-actions button{background:rgba(255,255,255,.08);color:#dbe8f7;border:1px solid rgba(255,255,255,.12);}
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
        background:linear-gradient(180deg,rgba(0,255,136,.10) 0%,rgba(0,200,255,.06) 100%);
        border:1px solid rgba(0,255,136,.28);
        box-shadow:0 40px 100px rgba(0,0,0,.5),0 0 60px rgba(0,255,136,.08);
        animation:opIn .5s cubic-bezier(.2,1,.2,1) both;">

        <!-- Animated checkmark ring -->
        <div style="width:88px;height:88px;border-radius:50%;margin:0 auto 22px;position:relative;
          background:rgba(0,255,136,.12);border:2px solid rgba(0,255,136,.35);
          display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid rgba(0,255,136,.18);animation:opRing 1.6s ease-out infinite;"></div>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:opCheck .6s ease .15s both;">
            <path d="M20 6 9 17l-5-5"/>
          </svg>
        </div>

        <!-- Title -->
        <div style="display:inline-flex;align-items:center;gap:8px;padding:5px 14px;border-radius:999px;
          background:rgba(0,255,136,.10);border:1px solid rgba(0,255,136,.22);
          color:#a7ffcf;font-size:.72rem;font-weight:900;letter-spacing:.06em;text-transform:uppercase;margin-bottom:14px;">
          <span style="width:7px;height:7px;border-radius:50%;background:#00ff88;display:inline-block;animation:opDot 1s ease-in-out infinite;"></span>
          Order Placed
        </div>

        <h2 style="font-family:var(--font-display,inherit);font-size:1.65rem;color:#f0f8ff;margin:0 0 10px;line-height:1.2;">
          Your Order is Placed!
        </h2>
        <p style="color:#8faec9;line-height:1.72;margin:0 0 6px;font-size:.93rem;">
          Please wait a few moments to complete the order.
        </p>
        <p style="color:#6a8aaa;font-size:.83rem;margin:0 0 22px;">
          It takes maximum <strong style="color:#ffa500;">10–15 minutes</strong> to process.
        </p>

        ${usdStr ? `
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:22px;">
          <span style="padding:8px 16px;border-radius:999px;background:rgba(0,255,136,.10);border:1px solid rgba(0,255,136,.20);color:#a7ffcf;font-weight:900;font-size:.88rem;">${usdStr}</span>
          ${bdtStr ? `<span style="padding:8px 16px;border-radius:999px;background:rgba(0,200,255,.10);border:1px solid rgba(0,200,255,.20);color:#9ee8ff;font-weight:900;font-size:.88rem;">${bdtStr}</span>` : ''}
          <span style="padding:8px 16px;border-radius:999px;background:rgba(255,166,0,.10);border:1px solid rgba(255,166,0,.20);color:#ffd580;font-weight:900;font-size:.88rem;">Processing</span>
        </div>` : ''}

        <!-- Redirect info -->
        <div style="padding:14px 16px;border-radius:16px;background:rgba(0,200,255,.06);border:1px solid rgba(0,200,255,.14);
          display:flex;align-items:center;gap:12px;text-align:left;margin-bottom:22px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" stroke-width="2.2" stroke-linecap="round" style="flex-shrink:0;">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          <div>
            <div style="color:#9ee8ff;font-weight:900;font-size:.83rem;">Redirecting to My Orders…</div>
            <div style="color:#5a7a94;font-size:.76rem;margin-top:2px;">Track your order status live from there.</div>
          </div>
        </div>

        <button id="opGoNow" type="button" style="width:100%;border:none;border-radius:16px;padding:15px;
          background:linear-gradient(135deg,#00c8ff,#00ff88);color:#02050a;font-weight:950;font-size:.98rem;cursor:pointer;
          box-shadow:0 16px 40px rgba(0,200,255,.2);">
          View My Orders Now
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
      window.location.href = 'dashboard.html?tab=orders';
    });

    // Auto redirect after 4 seconds
    setTimeout(() => {
      window.location.href = 'dashboard.html?tab=orders';
    }, 4000);
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
  };

  // Called from inline HTML when FF radio options are selected
  const _origFfUpdateAmount = window.ffUpdateAmount;
  window.ffUpdateAmount = function(usd) {
    _currentAmountUsd = Math.round(Number(usd) * 10000) / 10000;
    window.updateServiceAmountUI();
    const inp = document.getElementById('serviceAmountUsd');
    if (inp) inp.value = _currentAmountUsd;
  };

  function injectCheckoutPanel() {
    if (!form || document.getElementById('serviceCheckoutPanel')) return;

    const panel = document.createElement('div');
    panel.id = 'serviceCheckoutPanel';
    panel.innerHTML = `
      <div class="service-checkout-box">
        <div class="service-checkout-head">
          <div>
            <strong>Payment</strong>
            <span>Credit balance থেকে instant order দিন।</span>
          </div>
          <div class="service-price-pill">
            <span id="servicePriceUsd">$0</span>
            <small id="servicePriceBdt">৳0</small>
          </div>
        </div>
        <input type="hidden" id="serviceAmountUsd" value="0" />
        <div class="service-pay-actions">
          <button type="button" id="buyWithCreditBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="vertical-align:-3px;margin-right:6px;"><path d="M20 6 9 17l-5-5"/></svg> Place Order</button>
        </div>
        <p class="service-pay-note">Credit দিয়ে Free Fire top-up করলে auto processing হবে। Instant Pay secure verification থাকবে। Rate: $1 / ৳125.</p>
      </div>
    `;

    // Place payment buttons at the bottom where the old Submit Request button was.
    
    if (submitBtn) {
      submitBtn.style.display = 'none';
      form.insertBefore(panel, submitBtn);
    } else {
      form.appendChild(panel);
    }

    const style = document.createElement('style');
    style.textContent = `
      .service-checkout-box { background:rgba(0,200,255,.055); border:1px solid rgba(0,200,255,.18); border-radius:18px; padding:18px; margin:22px 0 6px; }
      .service-checkout-head { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; margin-bottom:14px; }
      .service-checkout-head strong { display:block; color:#e8edf5; font-size:1rem; margin-bottom:4px; }
      .service-checkout-head span { color:#7a8ca8; font-size:.84rem; line-height:1.55; }
      .service-price-pill { text-align:right; background:rgba(0,255,136,.08); border:1px solid rgba(0,255,136,.20); border-radius:14px; padding:10px 12px; min-width:112px; }
      .service-price-pill span { display:block; color:#00ff88; font-weight:900; font-size:1.15rem; }
      .service-price-pill small { display:block; color:#8fa2bb; margin-top:2px; }
      .service-pay-actions { display:grid; grid-template-columns:1fr; gap:12px; }
      .service-pay-actions button { border:0; border-radius:999px; padding:14px 20px; font-weight:900; cursor:pointer; font-size:.95rem; }
      #buyWithCreditBtn { background:linear-gradient(135deg,#00c8ff,#00ff88); color:#02050a; }
      
      .service-pay-note { color:#7a8ca8; font-size:.8rem; line-height:1.55; margin:12px 0 0; }
      @media(max-width:640px){ .service-checkout-head, .service-pay-actions { display:grid; grid-template-columns:1fr; } .service-price-pill { text-align:left; } }
    `;
    document.head.appendChild(style);

    const creditBtn = document.getElementById('buyWithCreditBtn');
    if (creditBtn) creditBtn.addEventListener('click', handleBuyWithCredit);
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
      const productId = selectedPackage.dataset.productId || selectedPackage.getAttribute('data-product-id') || '';
      const gameId = selectedPackage.dataset.gameId || selectedPackage.getAttribute('data-game-id') || 'free_fire_direct_topup_bangladesh_499';

      data.productId = productId;
      data.product_id = productId;
      data.fazercardsProductId = productId;
      data.gameId = gameId;
      data.game_id = gameId;
      data.packageName = selectedPackage.dataset.packageName || selectedPackage.value || '';
      data.provider = 'fazercards';
      data.autoTopupReady = !!productId;
    }

    data.freeFireUid = ffUid;
    data.playerId = ffUid;
    data.user_id = ffUid;

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
    enrichFreeFireAutoTopupDetails(data);
    return data;
  }

  function validateBasicDetails() {
    const isNoContact = NO_CONTACT_FIELDS.includes(activeFieldsType);

    if (!isNoContact) {
      const name = document.getElementById('mo_name')?.value.trim();
      const email = document.getElementById('mo_email')?.value.trim();
      if (!name || !email) {
        showStatus('Name এবং Email পূরণ করো।', 'error');
        return false;
      }
    }

    if (activeFieldsType === 'card') {
      const selectedCardType = document.querySelector('input[name="card_type"]:checked')?.value || '';
      const selectedCardPrice = document.getElementById('mo_card_price')?.value || '';
      if (!selectedCardType || !selectedCardPrice) {
        showStatus('Card type এবং fixed price select করো।', 'error');
        return false;
      }
    }

    if (activeFieldsType === 'ff') {
      const ffUid = document.getElementById('mo_ff_uid')?.value.trim();
      const selectedPackage = form?.querySelector('input[name="ff_package"]:checked');
      if (!selectedPackage) {
        showStatus('প্রথমে Free Fire package select করো।', 'error');
        return false;
      }
      if (!ffUid) {
        showStatus('Free Fire UID লিখে দিন।', 'error');
        return false;
      }
      if (!selectedPackage.dataset.productId) {
        showStatus('এই package-এর auto top-up product ID missing. System automatically process করবে।', 'error');
        return false;
      }
    }

    const amount = getServiceAmount();
    if (!amount || amount < 0.1) {
      showStatus('প্রথমে একটি package/variant select করো।', 'error');
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

  function openModal(serviceName, fieldsType) {
    if (!overlay || !form) return;

    injectCheckoutPanel();

    activeServiceName = serviceName;
    activeFieldsType = fieldsType || '';

    modalTitle.textContent = 'Apply for: ' + serviceName;
    modalSub.textContent = 'Package select করো তারপর Place Order করুন।';
    serviceInput.value = serviceName;
    showFields(fieldsType || '');
    if (fieldsType === 'card') resetCardPricing();
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
  }

  function closeModal() {
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  async function handleBuyWithCredit() {
    if (!window.rabbiAuth || !window.rabbiAuth.isLoggedIn()) {
      window.rabbiAuth && window.rabbiAuth.openLogin('apply');
      window._pendingService = { service: activeServiceName, fields: activeFieldsType };
      return;
    }

    if (!validateBasicDetails()) return;

    const btn = document.getElementById('buyWithCreditBtn');
    const old = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="vertical-align:-3px;margin-right:6px;animation:spin .7s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Processing…'; }

    const amountUsd = getServiceAmount();
    const details = collectFormData();

    // Show order placed animation IMMEDIATELY — don't wait for backend
    // Backend processes in background
    showServiceSuccess(null, amountUsd);

    // Fire backend in background (non-blocking)
    buyServiceWithCreditDirect({ serviceName: activeServiceName, fieldsType: activeFieldsType, amountUsd, details })
      .then(result => {
        if (!result.ok) {
          if (result.reason === 'insufficient') {
            // Already redirected to My Orders, but notify on return
            localStorage.setItem('orderFailReason', 'insufficient_balance');
          }
          console.error('[ServiceModal] Order result:', result);
        } else {
          sendToFormspree({ _payment_method: 'credit', _payment_status: 'paid_credit_pending_review', _amount_usd: amountUsd, _amount_bdt: Math.round(amountUsd * 125) }).catch(() => {});
        }
      })
      .catch(err => console.error('[ServiceModal] Order error:', err));
  }

  function handleInstantPay() {
    if (!window.rabbiAuth || !window.rabbiAuth.isLoggedIn()) {
      window.rabbiAuth && window.rabbiAuth.openLogin('apply');
      window._pendingService = { service: activeServiceName, fields: activeFieldsType };
      return;
    }

    if (!validateBasicDetails()) return;

    const amountUsd = getServiceAmount();
    const details = collectFormData();

    sessionStorage.setItem('pendingServicePayment', JSON.stringify({
      serviceName: activeServiceName,
      fieldsType: activeFieldsType,
      amountUsd,
      details,
      createdAt: new Date().toISOString()
    }));

    const url = `add-credit.html?mode=service&service=${encodeURIComponent(activeServiceName)}&usd=${encodeURIComponent(amountUsd)}`;
    window.location.href = url;
  }

  document.querySelectorAll('.service-apply-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const service = this.dataset.service || 'Service';
      const fields = this.dataset.fields || '';

      openModal(service, fields);
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
      <div style="width:72px;height:72px;background:rgba(0,255,136,0.1);border:2px solid rgba(0,255,136,0.3);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;color:#00ff88;"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <h3 style="font-family:var(--font-display);font-size:1.3rem;color:var(--text-primary);margin-bottom:10px;">Request Submitted!</h3>
      <p style="color:var(--text-secondary);font-size:0.9rem;line-height:1.7;margin-bottom:8px;">Your service request/payment has been saved successfully.<br/>Admin review pending.</p>
      <p style="color:var(--text-muted);font-size:0.78rem;margin-bottom:28px;">I will contact you soon.</p>
      <button onclick="document.getElementById('serviceModal').classList.remove('open');document.body.style.overflow='';" style="padding:11px 32px;background:var(--accent);color:#020a10;border:none;border-radius:50px;font-family:var(--font-display);font-weight:700;font-size:0.88rem;cursor:pointer;">Close</button>
    `;
    form.parentNode.insertBefore(div, form.nextSibling);
  }
  injectSuccessScreen();

  function openServiceFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const service = params.get('service');
    if (!service) return;
    const fields = params.get('fields') || '';
    const appId = params.get('app') || '';
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
