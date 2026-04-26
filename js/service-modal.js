/* ============================================================
   Service Order Modal — v3.0
   - All service buttons fixed
   - Payment choice: Buy with Credit / Buy with Instant Pay
   - Credit balance check and deduction
   - Instant Pay redirects to payment page with USD → BDT conversion
   - Original Formspree request feature preserved
   ============================================================ */

(function () {
  'use strict';

  const FORMSPREE = 'https://formspree.io/f/mojybwvn';

  const DEFAULT_SERVICE_PRICES = {
    'Facebook Meta Verified': 5,
    'Visa / Mastercard': 10,
    'Premium App & Subscription': 5,
    'Website Development': 50,
    'Ethical Hacking / Security Audit': 30,
    'Android App Development': 40,
    'Digital Branding': 15,
    'Premium Digital Services': 10
  };

  const overlay = document.getElementById('serviceModal');
  const modalClose = document.getElementById('modalClose');
  const modalTitle = document.getElementById('modalTitle');
  const modalSub = document.getElementById('modalSubtitle');
  const serviceInput = document.getElementById('modalServiceType');
  const form = document.getElementById('serviceOrderForm');
  const submitBtn = document.getElementById('modalSubmitBtn');
  const statusEl = document.getElementById('modalStatus');

  const allFields = {
    webDev: document.getElementById('webDevFields'),
    security: document.getElementById('securityFields'),
    android: document.getElementById('androidFields'),
    meta: document.getElementById('metaFields'),
    card: document.getElementById('cardFields'),
    proapp: document.getElementById('proappFields')
  };

  let activeServiceName = '';
  let activeFieldsType = '';

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
    Object.values(allFields).forEach(f => { if (f) f.style.display = 'none'; });
    if (type && allFields[type]) allFields[type].style.display = 'block';
  }

  function injectCheckoutPanel() {
    if (!form || document.getElementById('serviceCheckoutPanel')) return;

    const panel = document.createElement('div');
    panel.id = 'serviceCheckoutPanel';
    panel.innerHTML = `
      <div class="service-checkout-box">
        <div class="service-checkout-head">
          <div>
            <strong>Payment Method</strong>
            <span>Credit balance দিয়ে কিনুন অথবা instant manual payment করুন।</span>
          </div>
          <div class="service-price-pill">
            <span id="servicePriceUsd">$0</span>
            <small id="servicePriceBdt">0 BDT</small>
          </div>
        </div>
        <div class="service-amount-row">
          <label for="serviceAmountUsd">Service Amount (USD)</label>
          <input type="number" id="serviceAmountUsd" min="1" step="0.01" value="5" />
        </div>
        <div class="service-pay-actions">
          <button type="button" id="buyWithCreditBtn">Buy with Credit</button>
          <button type="button" id="buyInstantPayBtn">Buy with Instant Pay</button>
        </div>
        <p class="service-pay-note">Instant Pay করলে payment page open হবে, যেখানে USD amount BDT-তে convert হবে। Rate: $1 = 125 BDT.</p>
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
      .service-amount-row { display:grid; gap:7px; margin-bottom:14px; }
      .service-amount-row label { color:#c9d4e5; font-size:.86rem; font-weight:800; }
      .service-amount-row input { width:100%; padding:12px 14px; border-radius:13px; border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.25); color:#e8edf5; outline:none; }
      .service-pay-actions { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .service-pay-actions button { border:0; border-radius:999px; padding:13px 14px; font-weight:900; cursor:pointer; }
      #buyWithCreditBtn { background:linear-gradient(135deg,#00c8ff,#00ff88); color:#02050a; }
      #buyInstantPayBtn { background:rgba(255,255,255,.07); color:#e8edf5; border:1px solid rgba(255,255,255,.12); }
      .service-pay-note { color:#7a8ca8; font-size:.8rem; line-height:1.55; margin:12px 0 0; }
      @media(max-width:640px){ .service-checkout-head, .service-pay-actions { grid-template-columns:1fr; display:grid; } .service-price-pill { text-align:left; } }
    `;
    document.head.appendChild(style);

    const amountInput = document.getElementById('serviceAmountUsd');
    if (amountInput) amountInput.addEventListener('input', updateServiceAmountUI);

    const creditBtn = document.getElementById('buyWithCreditBtn');
    const instantBtn = document.getElementById('buyInstantPayBtn');

    if (creditBtn) creditBtn.addEventListener('click', handleBuyWithCredit);
    if (instantBtn) instantBtn.addEventListener('click', handleInstantPay);
  }

  function setDefaultAmount(serviceName) {
    const amountInput = document.getElementById('serviceAmountUsd');
    if (!amountInput) return;
    amountInput.value = DEFAULT_SERVICE_PRICES[serviceName] || 5;
    updateServiceAmountUI();
  }

  function getServiceAmount() {
    const value = Number(document.getElementById('serviceAmountUsd')?.value || 0);
    return value;
  }

  function updateServiceAmountUI() {
    const amount = getServiceAmount();
    const usdEl = document.getElementById('servicePriceUsd');
    const bdtEl = document.getElementById('servicePriceBdt');
    if (usdEl) usdEl.textContent = amount ? moneyUsd(amount) : '$0';
    if (bdtEl) bdtEl.textContent = amount ? moneyBdtFromUsd(amount) : '0 BDT';
  }

  function collectFormData() {
    if (!form) return {};
    const data = {};
    new FormData(form).forEach((val, key) => {
      if (val !== null && String(val).trim() !== '') data[key] = String(val).trim();
    });
    data.service_type = activeServiceName;
    return data;
  }

  function validateBasicDetails() {
    const name = document.getElementById('mo_name')?.value.trim();
    const email = document.getElementById('mo_email')?.value.trim();
    const message = document.getElementById('mo_message')?.value.trim();

    if (!name || !email || !message) {
      showStatus('⚠ Payment করার আগে Name, Email, Project Details পূরণ করো।', 'error');
      return false;
    }

    const amount = getServiceAmount();
    if (!amount || amount < 1) {
      showStatus('⚠ Minimum $1 service amount দিতে হবে।', 'error');
      return false;
    }

    return true;
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
    } catch (err) {
      // Payment/order is already stored in Firebase; Formspree failure should not block the user.
    }
  }

  function openModal(serviceName, fieldsType) {
    if (!overlay || !form) return;

    injectCheckoutPanel();

    activeServiceName = serviceName;
    activeFieldsType = fieldsType || '';

    modalTitle.textContent = 'Apply for: ' + serviceName;
    modalSub.textContent = 'Fill in your details, then choose Buy with Credit or Instant Pay.';
    serviceInput.value = serviceName;
    showFields(fieldsType || '');
    showStatus('', '');

    form.style.display = 'block';
    const successScreen = document.getElementById('modalSuccess');
    if (successScreen) successScreen.style.display = 'none';
    form.reset();
    serviceInput.value = serviceName;
    setDefaultAmount(serviceName);

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
      if (!window.buyServiceWithCredit) {
        showStatus('⚠ Wallet system loading failed. Please refresh and try again.', 'error');
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
        showStatus(`⚠ ${result.message} Add Credit করে আবার try করো।`, 'error');
        const target = `add-credit.html?usd=${encodeURIComponent(amountUsd)}`;
        setTimeout(() => {
          if (confirm('Balance কম। Add Credit page open করবে?')) window.location.href = target;
        }, 300);
      } else {
        showStatus('⚠ ' + (result.message || 'Payment failed.'), 'error');
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
      <div style="width:72px;height:72px;background:rgba(0,255,136,0.1);border:2px solid rgba(0,255,136,0.3);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:2rem;">✓</div>
      <h3 style="font-family:var(--font-display);font-size:1.3rem;color:var(--text-primary);margin-bottom:10px;">Request Submitted!</h3>
      <p style="color:var(--text-secondary);font-size:0.9rem;line-height:1.7;margin-bottom:8px;">Your service request/payment has been saved successfully.<br/>Admin review pending.</p>
      <p style="color:var(--text-muted);font-size:0.78rem;margin-bottom:28px;">📧 I will contact you soon.</p>
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

      const name = document.getElementById('mo_name').value.trim();
      const email = document.getElementById('mo_email').value.trim();
      const message = document.getElementById('mo_message').value.trim();

      if (!name || !email || !message) {
        showStatus('⚠ Please fill in Name, Email, and Project Details.', 'error');
        return;
      }

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
          showStatus('⚠ ' + err, 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Submit Request <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>';
        }
      } catch (err) {
        showStatus('⚠ Network error. Please try again.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit Request';
      }
    });
  }
})();
