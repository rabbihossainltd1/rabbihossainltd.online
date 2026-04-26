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

  // Fixed prices — user cannot change these
  const FIXED_SERVICE_PRICES = {
    'Facebook Meta Verified': 12,
    'Visa / Mastercard': 12,
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

  // Physical card address toggle
  document.addEventListener('change', function(e) {
    if (e.target && e.target.name === 'card_type') {
      const addrGroup = document.getElementById('cardAddressGroup');
      if (addrGroup) {
        addrGroup.style.display = e.target.value === 'Physical' ? 'block' : 'none';
        const addrTextarea = document.getElementById('mo_card_address');
        if (addrTextarea) addrTextarea.required = e.target.value === 'Physical';
      }
    }
  });

  let activeServiceName = '';
  let activeFieldsType = '';
  let _currentAmountUsd = 0;

  function moneyUsd(value) {
    return `$${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }

  function moneyBdtFromUsd(value) {
    return `${Math.round(Number(value || 0) * 125).toLocaleString('en-BD')} BDT`;
  }

  function showStatus(message, type) {
    if (!statusEl) return;
    statusEl.className = 'service-modal-status ' + (type || '');
    statusEl.textContent = message || '';
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
    if (bdtEl) bdtEl.textContent = _currentAmountUsd ? moneyBdtFromUsd(_currentAmountUsd) : '0 BDT';
    // also update the hidden amount input
    const inp = document.getElementById('serviceAmountUsd');
    if (inp) inp.value = _currentAmountUsd;
  };

  // Called from inline HTML when FF radio options are selected
  const _origFfUpdateAmount = window.ffUpdateAmount;
  window.ffUpdateAmount = function(usd) {
    _currentAmountUsd = Math.round(Number(usd) * 100) / 100;
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
            <strong>Payment Method</strong>
            <span>Credit balance দিয়ে কিনুন অথবা instant manual payment করুন।</span>
          </div>
          <div class="service-price-pill">
            <span id="servicePriceUsd">$0</span>
            <small id="servicePriceBdt">0 BDT</small>
          </div>
        </div>
        <input type="hidden" id="serviceAmountUsd" value="0" />
        <div class="service-pay-actions">
          <button type="button" id="buyWithCreditBtn">Buy with Credit</button>
          <button type="button" id="buyInstantPayBtn">Buy with Instant Pay</button>
        </div>
        <p class="service-pay-note">Instant Pay করলে payment page open হবে। Rate: $1 = 125 BDT.</p>
      </div>
    `;

    form.insertBefore(panel, form.firstChild);

    const style = document.createElement('style');
    style.textContent = `
      .service-checkout-box { background:rgba(0,200,255,.055); border:1px solid rgba(0,200,255,.18); border-radius:18px; padding:18px; margin-bottom:20px; }
      .service-checkout-head { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; margin-bottom:14px; }
      .service-checkout-head strong { display:block; color:#e8edf5; font-size:1rem; margin-bottom:4px; }
      .service-checkout-head span { color:#7a8ca8; font-size:.84rem; line-height:1.55; }
      .service-price-pill { text-align:right; background:rgba(0,255,136,.08); border:1px solid rgba(0,255,136,.20); border-radius:14px; padding:10px 12px; min-width:112px; }
      .service-price-pill span { display:block; color:#00ff88; font-weight:900; font-size:1.15rem; }
      .service-price-pill small { display:block; color:#8fa2bb; margin-top:2px; }
      .service-pay-actions { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .service-pay-actions button { border:0; border-radius:999px; padding:13px 14px; font-weight:900; cursor:pointer; }
      #buyWithCreditBtn { background:linear-gradient(135deg,#00c8ff,#00ff88); color:#02050a; }
      #buyInstantPayBtn { background:rgba(255,255,255,.07); color:#e8edf5; border:1px solid rgba(255,255,255,.12); }
      .service-pay-note { color:#7a8ca8; font-size:.8rem; line-height:1.55; margin:12px 0 0; }
      @media(max-width:640px){ .service-checkout-head, .service-pay-actions { display:grid; grid-template-columns:1fr; } .service-price-pill { text-align:left; } }
    `;
    document.head.appendChild(style);

    const creditBtn = document.getElementById('buyWithCreditBtn');
    const instantBtn = document.getElementById('buyInstantPayBtn');
    if (creditBtn) creditBtn.addEventListener('click', handleBuyWithCredit);
    if (instantBtn) instantBtn.addEventListener('click', handleInstantPay);
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

  function collectFormData() {
    if (!form) return {};
    const data = {};
    new FormData(form).forEach((val, key) => {
      if (val !== null && String(val).trim() !== '') data[key] = String(val).trim();
    });
    data.service_type = activeServiceName;
    data._amount_usd = _currentAmountUsd;
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
    modalSub.textContent = 'Package select করো তারপর Buy with Credit অথবা Instant Pay।';
    serviceInput.value = serviceName;
    showFields(fieldsType || '');
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
    const old = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }

    const amountUsd = getServiceAmount();
    const details = collectFormData();

    try {
      const walletReady = await waitForWalletFunction();
      if (!walletReady || !window.buyServiceWithCredit) {
        showStatus('Wallet system loading failed. Please refresh.', 'error');
        return;
      }

      const result = await window.buyServiceWithCredit({
        serviceName: activeServiceName,
        fieldsType: activeFieldsType,
        amountUsd,
        details
      });

      if (result.ok) {
        await sendToFormspree({
          _payment_method: 'credit',
          _payment_status: 'paid_credit_pending_review',
          _amount_usd: amountUsd,
          _amount_bdt: Math.round(amountUsd * 125)
        });
        form.style.display = 'none';
        const successScreen = document.getElementById('modalSuccess');
        if (successScreen) successScreen.style.display = 'block';
      } else if (result.reason === 'insufficient') {
        showStatus(`${result.message} Add Credit করে আবার try করো।`, 'error');
        const target = `add-credit.html?usd=${encodeURIComponent(amountUsd)}`;
        setTimeout(() => {
          if (confirm('Balance কম। Add Credit page open করবে?')) window.location.href = target;
        }, 300);
      } else {
        showStatus(result.message || 'Payment failed.', 'error');
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = old || 'Buy with Credit'; }
    }
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

      if (window.rabbiAuth && !window.rabbiAuth.isLoggedIn()) {
        window.rabbiAuth.openLogin('apply');
        window._pendingService = { service, fields };
        return;
      }
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

  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      if (window.rabbiAuth && !window.rabbiAuth.isLoggedIn()) {
        window.rabbiAuth.openLogin('apply');
        return;
      }

      if (!validateBasicDetails()) return;

      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Sending…';
      showStatus('', '');

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
