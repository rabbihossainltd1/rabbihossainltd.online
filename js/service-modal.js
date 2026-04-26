/* ============================================================
   Service Order Modal — v2.0
   - Login gate: user must be signed in to submit
   - Beautiful success screen (form hides)
   - New field types: meta, card, proapp
   ============================================================ */

(function () {
  'use strict';

  const FORMSPREE = 'https://formspree.io/f/mojybwvn';

  const overlay    = document.getElementById('serviceModal');
  const modalClose = document.getElementById('modalClose');
  const modalTitle = document.getElementById('modalTitle');
  const modalSub   = document.getElementById('modalSubtitle');
  const serviceInput = document.getElementById('modalServiceType');
  const form       = document.getElementById('serviceOrderForm');
  const submitBtn  = document.getElementById('modalSubmitBtn');
  const statusEl   = document.getElementById('modalStatus');

  /* Field sections */
  const allFields = {
    webDev  : document.getElementById('webDevFields'),
    security: document.getElementById('securityFields'),
    android : document.getElementById('androidFields'),
    meta    : document.getElementById('metaFields'),
    card    : document.getElementById('cardFields'),
    proapp  : document.getElementById('proappFields'),
  };

  function showFields(type) {
    Object.values(allFields).forEach(f => { if (f) f.style.display = 'none'; });
    if (type && allFields[type]) allFields[type].style.display = 'block';
  }

  function openModal(serviceName, fieldsType) {
    if (!overlay) return;
    modalTitle.textContent = 'Apply for: ' + serviceName;
    modalSub.textContent   = 'Fill in your project details and I\'ll reply within 24–48 hours.';
    serviceInput.value     = serviceName;
    showFields(fieldsType || '');
    statusEl.className     = 'service-modal-status';
    statusEl.textContent   = '';
    // Show form, hide success screen
    if (form) form.style.display = 'block';
    const successScreen = document.getElementById('modalSuccess');
    if (successScreen) successScreen.style.display = 'none';
    form.reset();
    serviceInput.value = serviceName;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* Bind apply buttons */
  document.querySelectorAll('.service-apply-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const service = this.dataset.service || 'Service';
      const fields  = this.dataset.fields  || '';

      /* Login gate — check if user is logged in via auth.js */
      if (window.rabbiAuth && !window.rabbiAuth.isLoggedIn()) {
        window.rabbiAuth.openLogin('apply');
        window._pendingService = { service, fields };
        return;
      }
      openModal(service, fields);
    });
  });

  /* After login, open pending modal */
  window.rabbiAuth && window.addEventListener('rabbi:loggedin', function () {
    if (window._pendingService) {
      const { service, fields } = window._pendingService;
      window._pendingService = null;
      openModal(service, fields);
    }
  });

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (overlay)    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  /* Success screen HTML (injected once) */
  function injectSuccessScreen() {
    if (document.getElementById('modalSuccess')) return;
    const div = document.createElement('div');
    div.id = 'modalSuccess';
    div.style.cssText = 'display:none;text-align:center;padding:20px 10px 10px;';
    div.innerHTML = `
      <div style="width:72px;height:72px;background:rgba(0,255,136,0.1);border:2px solid rgba(0,255,136,0.3);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:2rem;">✓</div>
      <h3 style="font-family:var(--font-display);font-size:1.3rem;color:var(--text-primary);margin-bottom:10px;">Request Submitted!</h3>
      <p style="color:var(--text-secondary);font-size:0.9rem;line-height:1.7;margin-bottom:8px;">Your request has been received successfully.<br/>I'll get back to you within <strong style="color:#4dffaa;">24–48 hours</strong>.</p>
      <p style="color:var(--text-muted);font-size:0.78rem;margin-bottom:28px;">📧 Check your email for a confirmation.</p>
      <button onclick="document.getElementById('serviceModal').classList.remove('open');document.body.style.overflow='';" style="padding:11px 32px;background:var(--accent);color:#020a10;border:none;border-radius:50px;font-family:var(--font-display);font-weight:700;font-size:0.88rem;cursor:pointer;">Close</button>
    `;
    if (form) form.parentNode.insertBefore(div, form.nextSibling);
  }
  injectSuccessScreen();

  /* Form submit */
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      /* Re-check login */
      if (window.rabbiAuth && !window.rabbiAuth.isLoggedIn()) {
        window.rabbiAuth.openLogin('apply');
        return;
      }

      const name    = document.getElementById('mo_name').value.trim();
      const email   = document.getElementById('mo_email').value.trim();
      const message = document.getElementById('mo_message').value.trim();

      if (!name || !email || !message) {
        statusEl.className   = 'service-modal-status error';
        statusEl.textContent = '⚠ Please fill in Name, Email, and Project Details.';
        return;
      }

      submitBtn.disabled  = true;
      submitBtn.innerHTML = 'Sending…';
      statusEl.className  = 'service-modal-status';

      const data = {};
      new FormData(form).forEach((val, key) => { if (val) data[key] = val; });

      /* Attach logged-in user info */
      if (window.rabbiAuth && window.rabbiAuth.getUser()) {
        data._user_uid   = window.rabbiAuth.getUser().uid;
        data._user_email = window.rabbiAuth.getUser().email;
      }

      try {
        const res  = await fetch(FORMSPREE, {
          method : 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body   : JSON.stringify(data)
        });
        const json = await res.json();

        if (res.ok) {
          /* Hide form, show success screen */
          form.style.display = 'none';
          const successScreen = document.getElementById('modalSuccess');
          if (successScreen) successScreen.style.display = 'block';
        } else {
          const err = json.errors ? json.errors.map(e => e.message).join(', ') : 'Something went wrong.';
          statusEl.className   = 'service-modal-status error';
          statusEl.textContent = '⚠ ' + err;
          submitBtn.disabled   = false;
          submitBtn.innerHTML  = 'Submit Request <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>';
        }
      } catch (err) {
        statusEl.className   = 'service-modal-status error';
        statusEl.textContent = '⚠ Network error. Please try again.';
        submitBtn.disabled   = false;
        submitBtn.innerHTML  = 'Submit Request';
      }
    });
  }

})();
