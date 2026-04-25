/* ============================================================
   Service Order Modal — v1.0
   Formspree endpoint: https://formspree.io/f/mojybwvn
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

  /* Conditional field sections */
  const webDevFields  = document.getElementById('webDevFields');
  const securityFields = document.getElementById('securityFields');
  const androidFields = document.getElementById('androidFields');

  function showFields(type) {
    [webDevFields, securityFields, androidFields].forEach(f => { if (f) f.style.display = 'none'; });
    if (type === 'webDev'    && webDevFields)   webDevFields.style.display   = 'block';
    if (type === 'security'  && securityFields) securityFields.style.display = 'block';
    if (type === 'android'   && androidFields)  androidFields.style.display  = 'block';
  }

  function openModal(serviceName, fieldsType) {
    if (!overlay) return;
    modalTitle.textContent = 'Apply for: ' + serviceName;
    modalSub.textContent   = 'Fill in your project details and I\'ll get back to you within 24–48 hours.';
    serviceInput.value     = serviceName;
    showFields(fieldsType || '');
    statusEl.className     = 'service-modal-status';
    statusEl.textContent   = '';
    form.reset();
    serviceInput.value = serviceName; // restore after reset
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* Bind "Apply Now / Get Now / Start" buttons */
  document.querySelectorAll('.service-apply-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const service = this.dataset.service || 'Service';
      const fields  = this.dataset.fields  || '';
      openModal(service, fields);
    });
  });

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (overlay)    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  /* Form submit */
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const name    = document.getElementById('mo_name').value.trim();
      const email   = document.getElementById('mo_email').value.trim();
      const message = document.getElementById('mo_message').value.trim();

      if (!name || !email || !message) {
        statusEl.className   = 'service-modal-status error';
        statusEl.textContent = 'Please fill in your name, email, and project details.';
        return;
      }

      submitBtn.disabled   = true;
      submitBtn.innerHTML  = 'Sending…';
      statusEl.className   = 'service-modal-status';
      statusEl.textContent = '';

      /* Build payload — collect all visible form fields */
      const data = {};
      new FormData(form).forEach((val, key) => {
        if (val) data[key] = val;
      });

      try {
        const res  = await fetch(FORMSPREE, {
          method : 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body   : JSON.stringify(data)
        });
        const json = await res.json();

        if (res.ok) {
          statusEl.className   = 'service-modal-status success';
          statusEl.textContent = '✓ Request sent! I\'ll get back to you within 24–48 hours.';
          form.reset();
          submitBtn.disabled  = false;
          submitBtn.innerHTML = 'Submit Request <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>';
        } else {
          const err = (json.errors && json.errors.length) ? json.errors.map(e => e.message).join(', ') : 'Something went wrong.';
          statusEl.className   = 'service-modal-status error';
          statusEl.textContent = '⚠ ' + err;
          submitBtn.disabled  = false;
          submitBtn.innerHTML = 'Submit Request <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>';
        }
      } catch (err) {
        statusEl.className   = 'service-modal-status error';
        statusEl.textContent = '⚠ Network error. Please try again.';
        submitBtn.disabled  = false;
        submitBtn.innerHTML = 'Submit Request';
      }
    });
  }

})();
