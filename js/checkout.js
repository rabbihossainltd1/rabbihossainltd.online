/* ============================================================
   Checkout — schema-driven buy form (compact redesign)
   ------------------------------------------------------------
   Replaces the hardcoded 657-line field markup with a
   SERVICES schema. Fields render Claude-style:
     - options  → collapsible dropdown (pkg-toggle + list)
     - toggle   → segmented buttons
     - text / email / textarea / select
   Real engine (payment, FF live prices, proapp plans, coupons,
   order saving) is preserved via the same input names/IDs the
   engine reads.
   ============================================================ */
(function () {
  'use strict';

  // Embedded mode: the cart page loads this checkout in an iframe so the
  // customer can pick a plan without leaving the cart. Hides "Pay Now"
  // (the parent's "Checkout & Pay" drives payment) and reports back to the
  // parent when an item is configured.
  const EMBED = (function () {
    try { return new URLSearchParams(window.location.search).get('embed') === '1'; }
    catch (e) { return false; }
  })();

  /* ── Registry (shared plan catalog — js/plans.js) ─────────── */
  const RH = window.RH_PLANS || {};
  const SERVICES = RH.SERVICES || {};
  const PREMIUM_APPS = RH.PREMIUM_APPS || {};
  const APPS = RH.APPS || [];
  const FF_VARIANTS = RH.FF_VARIANTS || {};
  const CARD_PRICE_OPTIONS = RH.CARD_PRICE_OPTIONS || { Physical: [110,550,1200], Virtual: [12,55,105] };

  const IMG_OVERRIDE = { 'ff-ff4x':'ff-h4x', 'adsremove':'remove-ads', 'premiere':'premiere-pro' };
  const INFO_KEY_BY_FIELDS = { card:'card', meta:'meta', ff:'ff', ffDrip:'ffDrip', ffFf4x:'ffDrip', ffIos:'ffIos', ffPc:'ffPc', ffBrMods:'ffBrMods' };

  /* ── helpers ──────────────────────────────────────────────── */
  const $ = function (id) { return document.getElementById(id); };
  const moneyUsd = v => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const moneyBdt = v => '৳' + Math.round(Number(v || 0) * 125).toLocaleString('en-BD');
  const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;');

  let active = null;        // resolved {slug, def}
  let sel = {};             // dropdown/toggle selections keyed by field name
  let openPkg = {};         // which dropdowns are open
  let infoOpen = false;
  let formState = {};       // text/textarea/select field values (persist across re-render)

  function userInfo() {
    try {
      const u = window.rabbiAuth && window.rabbiAuth.getUser && window.rabbiAuth.getUser();
      if (u && (u.displayName || u.email || u.name)) return u;
    } catch (e) {}
    // Fallback to the cached session (painted by boot-auth.js before Firebase settles)
    // so name/email show on first paint instead of only after an interaction.
    try {
      const c = JSON.parse(localStorage.getItem('rh_user_cache') || 'null');
      if (c && (c.displayName || c.email)) return { displayName: c.displayName || '', email: c.email || '', name: c.displayName || '', uid: c.uid || '' };
    } catch (e) {}
    return null;
  }

  /* ── resolve URL → service ────────────────────────────────── */
  function findBySignature(name, fields, proapp) {
    const keys = Object.keys(SERVICES);
    for (let i = 0; i < keys.length; i++) {
      const s = SERVICES[keys[i]];
      if (s.name !== name) continue;
      if (fields && s.fields !== fields) continue;
      if (proapp) { if (s.proapp === proapp) return keys[i]; continue; }
      if (!s.proapp) return keys[i];
    }
    return '';
  }
  function resolveTarget() {
    const p = new URLSearchParams(window.location.search);
    const raw = (p.get('service') || '').trim();
    if (!raw) return null;
    const slug = raw.toLowerCase();
    if (SERVICES[slug]) return { slug, def: SERVICES[slug] };
    const decoded = decodeURIComponent(raw);
    const fields = (p.get('fields') || '').trim();
    const app = (p.get('app') || p.get('proapp') || '').trim().toLowerCase();
    const found = findBySignature(decoded, fields, app);
    if (found) return { slug: found, def: SERVICES[found] };
    return null;
  }

  /* ── description from SERVICE_INFO ────────────────────────── */
  function infoForKey(def) {
    if (def.proapp) return def.proapp;
    return INFO_KEY_BY_FIELDS[def.fields] || '';
  }
  function renderInfo(def) {
    const btn = $('infoBtn'), panel = $('infoPanel'), text = $('infoText');
    if (!btn || !panel || !text) return;
    const key = infoForKey(def);
    const info = (typeof window.SERVICE_INFO === 'object' && key) ? window.SERVICE_INFO[key] : null;
    if (info) {
      const bn = !!(window.rabbiLang && window.rabbiLang.isBn && window.rabbiLang.isBn());
      let html = '';
      if (info.tagline) html += '<b>' + esc(info.tagline) + '</b><br>';
      html += '<p>' + esc(bn ? (info.what_bn || info.what_en || '') : (info.what_en || info.what_bn || '')) + '</p>';
      if (info.features && info.features.length) {
        html += '<ul style="margin:8px 0 0;padding-left:16px;display:grid;gap:4px;">' +
          info.features.map(function (f) {
            return '<li>' + esc(bn ? (f.bn || f.en) : (f.en || f.bn)) + '</li>';
          }).join('') + '</ul>';
      }
      if (info.note_bn || info.note_en) {
        html += '<div style="margin-top:10px;opacity:.8;">' + (bn ? info.note_bn : info.note_en) + '</div>';
      }
      text.innerHTML = html;
      btn.style.display = 'grid';
      btn.hidden = false;
      function toggleInfo(e) {
        if (e && e.target && e.target.closest && e.target.closest('a')) return;
        infoOpen = !infoOpen;
        panel.classList.toggle('open', infoOpen);
        btn.classList.toggle('open', infoOpen);
        btn.setAttribute('aria-expanded', infoOpen ? 'true' : 'false');
        btn.setAttribute('aria-label', infoOpen ? 'Hide product info' : 'Product info');
      }
      btn.onclick = toggleInfo;
      panel.onclick = toggleInfo;
      const title = $('checkoutTitle');
      if (title && !title._infoWired) {
        title._infoWired = true;
        title.style.cursor = 'pointer';
        title.addEventListener('click', toggleInfo);
      }
    } else {
      btn.style.display = 'none';
    }
  }

  /* ── header / sticky price sync ───────────────────────────── */
  function syncPrices() {
    const src = $('servicePriceUsd'), srcBdt = $('servicePriceBdt');
    const usd = src ? src.textContent : '$0';
    const bdt = srcBdt ? srcBdt.textContent : '৳0';
    const hU = $('headerPriceUsd'), hB = $('headerPriceBdt');
    if (hU) hU.textContent = usd;
    if (hB) hB.textContent = bdt;
    const sT = $('stickyTotal');
    if (sT) sT.textContent = bdt;
    const sL = $('stickyPayLabel');
    if (sL) sL.textContent = (bdt && bdt !== '৳0') ? ('Pay Now (' + bdt + ')') : 'Pay Now';
  }

  /* ── field renderers (Claude style) ───────────────────────── */
  const svgChev = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  const svgOk = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12.5 5 5L20 6.5"/></svg>';
  const svgW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>';

  function fieldLabel(f) {
    return `<label class="form-label">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}</label>`;
  }

  function renderOptions(f) {
    const wrap = document.createElement('div');
    wrap.className = 'form-group';
    wrap.innerHTML = fieldLabel(f);
    const isOpen = !!openPkg[f.name];
    const options = (typeof f.getOptions === 'function') ? f.getOptions() : (f.options || []);
    const chosen = sel[f.name] ? options.find(x => String(x.id) === String(sel[f.name])) : null;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'pkg-toggle' + (isOpen ? ' open' : '');
    toggle.innerHTML = `
      <span class="pt-label">${chosen ? esc(chosen.title) + (chosen.tag ? ` <span class="tag">${esc(chosen.tag)}</span>` : '') : (f.placeholder || 'Choose')}${!chosen ? '<small>Tap to view</small>' : ''}</span>
      <span class="pt-right">${chosen && chosen.price != null ? `<span class="pt-price">${moneyUsd(chosen.price)}</span>` : ''}${svgChev}</span>`;
    toggle.onclick = function () { openPkg[f.name] = !openPkg[f.name]; render(); };
    wrap.appendChild(toggle);

    // hidden value that the engine's FormData reads
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = f.name;
    hidden.value = chosen ? (chosen.value != null ? chosen.value : chosen.id) : '';
    if (f.hiddenId) hidden.id = f.hiddenId;
    wrap.appendChild(hidden);

    if (isOpen) {
      const opts = document.createElement('div');
      opts.className = 'opts';
      options.forEach(function (o) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'opt' + (chosen && String(o.id) === String(chosen.id) ? ' sel' : '');
        b.innerHTML = `<span class="radio"></span><span class="lbl">${esc(o.title)}${o.tag ? `<span class="tag">${esc(o.tag)}</span>` : ''}${o.desc ? `<small>${esc(o.desc)}</small>` : ''}</span><span class="p">${o.price != null ? moneyUsd(o.price) : ''}</span>`;
        b.onclick = function () {
          sel[f.name] = o.id;
          openPkg[f.name] = false;
          if (f.onChange) f.onChange(o);
          render();
        };
        opts.appendChild(b);
      });
      wrap.appendChild(opts);
    }
    return wrap;
  }

  function renderToggle(f) {
    const wrap = document.createElement('div');
    wrap.className = 'form-group';
    wrap.innerHTML = fieldLabel(f);
    const tg = document.createElement('div');
    tg.className = 'tgl';
    const cur = sel[f.name] || f.default || f.options[0];
    f.options.forEach(function (o) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = o;
      b.className = cur === o ? 'active' : '';
      b.onclick = function () { sel[f.name] = o; if (f.onChange) f.onChange(o); render(); };
      tg.appendChild(b);
    });
    wrap.appendChild(tg);
    // real radio (visually hidden) so the engine's `input[name]:checked` + FormData work
    f.options.forEach(function (o) {
      const r = document.createElement('input');
      r.type = 'radio'; r.name = f.name; r.value = o;
      r.checked = cur === o; r.style.display = 'none';
      wrap.appendChild(r);
    });
    return wrap;
  }

  function renderText(f) {
    const wrap = document.createElement('div');
    wrap.className = 'form-group';
    const type = f.type === 'email' ? 'text' : f.type;
    const val = (f.name in formState) ? formState[f.name] : (f.value || '');
    const readonly = f.readonly ? 'readonly' : '';
    wrap.innerHTML = fieldLabel(f) +
      `<input class="form-input" type="${type}" id="${f.id || ''}" name="${f.name}" placeholder="${esc(f.placeholder || '')}" value="${esc(val)}" ${f.required ? 'required' : ''} ${readonly} />`;
    const inp = wrap.querySelector('input');
    if (!f.readonly) inp.addEventListener('input', function () { formState[f.name] = inp.value; });
    return wrap;
  }

  function renderTextarea(f) {
    const wrap = document.createElement('div');
    wrap.className = 'form-group';
    const val = (f.name in formState) ? formState[f.name] : (f.value || '');
    wrap.innerHTML = fieldLabel(f) +
      `<textarea class="form-textarea" name="${f.name}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''}>${esc(val)}</textarea>`;
    const ta = wrap.querySelector('textarea');
    ta.addEventListener('input', function () { formState[f.name] = ta.value; });
    return wrap;
  }

  function renderSelect(f) {
    const wrap = document.createElement('div');
    wrap.className = 'form-group';
    const val = (f.name in formState) ? formState[f.name] : '';
    let o = `<option value="">Select…</option>`;
    f.options.forEach(x => { o += `<option value="${esc(x)}"${x === val ? ' selected' : ''}>${esc(x)}</option>`; });
    wrap.innerHTML = fieldLabel(f) + `<select class="form-input form-select" name="${f.name}">${o}</select>`;
    const sel2 = wrap.querySelector('select');
    sel2.addEventListener('change', function () { formState[f.name] = sel2.value; });
    return wrap;
  }

  /* ── per-service schema ───────────────────────────────────── */
  function schemaFor(def) {
    const profile = userInfo();
    const contact = [
      { type:'text', name:'name', id:'mo_name', label:'Full Name', required:true, readonly:true, value: (profile && (profile.displayName || profile.name)) || '' },
      { type:'email', name:'email', id:'mo_email', label:'Email Address', required:true, placeholder:'your@email.com', value: (profile && profile.email) || '' }
    ];

    switch (def.fields) {
      case 'card': return [
        { type:'toggle', name:'card_type', label:'Card Type', default:'Physical', options:['Physical','Virtual'], onChange: function(){ delete sel['card_price_package']; window.setServiceAmountUsd(0); } },
        { type:'options', name:'card_price_package', label:'Card Price', placeholder:'Choose card price', getOptions: function(){
            const t = sel['card_type'] || 'Physical';
            const arr = CARD_PRICE_OPTIONS[t] || CARD_PRICE_OPTIONS.Physical;
            return arr.map(p => ({ id: t.toLowerCase() + '_' + p, value: String(p), title: t + ' Card — $' + Number(p).toLocaleString('en-US'), price: p }));
          }, onChange: function(o){
            window.setServiceAmountUsd(o.price);
          } },
        { type:'text', name:'card_name', label:'Name for Card', placeholder:'Name to print on card' },
        { type:'textarea', name:'card_address', label:'Delivery Address', required:true, placeholder:'Enter your full delivery address…', showWhen: function(){ return (sel['card_type'] || 'Physical') === 'Physical'; } }
      ].concat(contact);

      case 'meta': return [
        { type:'toggle', name:'meta_type', label:'Verification Type', default:'Page', options:['Page','Personal ID'] },
        { type:'text', name:'fb_url', label:'Facebook Page / Profile URL', placeholder:'https://facebook.com/yourpage' }
      ].concat(contact);

      case 'webDev': return [
        { type:'select', name:'website_type', label:'Website Type', options:['Landing Page / Portfolio','Business / Corporate Website','E-commerce Store','Blog / News Site','Web Application','WordPress Website','Other'] },
        { type:'select', name:'pages', label:'Number of Pages', options:['1–3 pages','4–7 pages','8–15 pages','15+ pages','Not sure yet'] },
        { type:'text', name:'features', label:'Required Features', placeholder:'e.g. contact form, payment gateway, admin panel…' },
        { type:'text', name:'existing_url', label:'Existing Website URL (if any)', placeholder:'https://yourwebsite.com' }
      ].concat(contact);

      case 'security': return [
        { type:'select', name:'target_type', label:'Target / System Type', options:['Web Application','Network / Server','Mobile App','API / Backend','Full Infrastructure'] }
      ].concat(contact);

      case 'android': return [
        { type:'select', name:'app_type', label:'App Category', options:['Business / Productivity','E-commerce','Social / Community','Education','Utility / Tools','Other'] }
      ].concat(contact);

      case 'ffDrip': case 'ffFf4x': case 'ffIos': case 'ffPc': case 'ffBrMods': {
        const v = FF_VARIANTS[def.fields];
        return [
          { type:'options', name:v.name, label:'Choose Variant', placeholder:'Variant Choose', options: v.rows.map(r => ({ id:r[0], title:r[0], price:r[2], tag:null })), onChange: function(o){ window.ffUpdateAmount(o.price); } },
          { type:'email', name:v.email, label:'Delivery Email', required:true, placeholder:'your@email.com' }
        ];
      }

      case 'ff': return [];   // rendered specially below (live prices + UID verify)
      case 'proapp': return []; // rendered specially below (app + plan)
      default: return contact;  // digital-branding, premium-services, others
    }
  }

  /* ── special renderers ────────────────────────────────────── */
  function renderFF() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="form-group" id="ffServerGroup">
        <label class="form-label">Server</label>
        <select class="form-input" id="ffServerSelect"></select>
      </div>
      <div class="form-group">
        <label class="form-label">Top-up Type</label>
        <div class="tgl" id="ffTypeToggle">
          <button type="button" class="active" data-t="diamond">Diamond</button>
          <button type="button" data-t="weekly">Weekly / Monthly</button>
        </div>
      </div>
      <div class="form-group" id="ffDiamondOptions">
        <label class="form-label">Choose Diamond Package</label>
        <div id="ffDiamondOptionsList"><div class="i4g-loading-state"><span class="i4g-spinner"></span>Loading live prices…</div></div>
      </div>
      <div class="form-group" id="ffWeeklyOptions" style="display:none">
        <label class="form-label">Choose Membership Plan</label>
        <div id="ffMembershipOptionsList"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Free Fire UID <span class="req">*</span></label>
        <div class="i4g-uid-row">
          <input class="form-input" type="text" id="mo_ff_uid" name="ff_uid" placeholder="Enter your Free Fire UID number" />
          <button type="button" id="i4g-check-player-btn">Check</button>
          <button type="button" id="i4g-ff-info-btn" aria-label="Player info">!</button>
        </div>
        <div id="i4g-player-status"></div>
      </div>`;

    const tg = wrap.querySelector('#ffTypeToggle');
    window.ffSelectType = function (t) {
      tg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.t === t));
      wrap.querySelector('#ffDiamondOptions').style.display = t === 'diamond' ? '' : 'none';
      wrap.querySelector('#ffWeeklyOptions').style.display = t === 'weekly' ? '' : 'none';
    };
    tg.querySelectorAll('button').forEach(b => b.onclick = () => window.ffSelectType(b.dataset.t));

    // trigger item4gamer load
    setTimeout(function () {
      if (window.Item4Gamer && window.Item4Gamer.loadAndRender) window.Item4Gamer.loadAndRender();
    }, 100);

    return wrap;
  }

  function renderProapp(def) {
    const app = APPS.find(a => a.id === def.proapp) || APPS[0];
    const wrap = document.createElement('div');

    // hidden app name (kept for order data)
    wrap.appendChild(document.createElement('input')).outerHTML = `<input type="hidden" id="mo_app_name" name="app_name" value="${esc(app.name)}" />`;

    // plan dropdown
    const planWrap = document.createElement('div');
    planWrap.className = 'form-group';
    planWrap.innerHTML = `<label class="form-label">Plan Choose</label>`;
    const planToggle = document.createElement('button');
    planToggle.type = 'button';
    planToggle.className = 'pkg-toggle' + (openPkg._plan ? ' open' : '');
    const planChosen = sel._plan ? app.plans.find(p => String(p.usd) === String(sel._plan)) : null;
    planToggle.innerHTML = `<span class="pt-label">${planChosen ? esc(planChosen.label) : 'Plan Choose'}${!planChosen ? '<small>Tap to view</small>' : ''}</span><span class="pt-right">${planChosen ? `<span class="pt-price">${moneyUsd(planChosen.usd)}</span>` : ''}${svgChev}</span>`;
    planToggle.onclick = () => { openPkg._plan = !openPkg._plan; render(); };
    planWrap.appendChild(planToggle);
    planWrap.appendChild(document.createElement('input')).outerHTML = `<input type="hidden" id="mo_plan_type" name="plan_type" value="" /><input type="hidden" id="mo_plan_usd" name="plan_usd" value="" />`;
    if (openPkg._plan) {
      const list = document.createElement('div');
      list.className = 'opts';
      app.plans.forEach(p => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'opt' + (planChosen && String(p.usd) === String(planChosen.usd) ? ' sel' : '');
        b.innerHTML = `<span class="radio"></span><span class="lbl">${esc(p.label)}</span><span class="p">${moneyUsd(p.usd)}</span>`;
        b.onclick = () => {
          sel._plan = p.usd;
          openPkg._plan = false;
          window.setServiceAmountUsd(p.usd);
          render();
        };
        list.appendChild(b);
      });
      planWrap.appendChild(list);
    }
    // persist plan identity so the server catalog can resolve it
    if (planChosen) {
      planWrap.querySelector('#mo_plan_type').value = planChosen.label;
      planWrap.querySelector('#mo_plan_usd').value = planChosen.usd;
    }
    wrap.appendChild(planWrap);

    // Full Name — fixed to the signed-in user's profile name (read-only)
    const profile = userInfo();
    wrap.appendChild(renderText({ type:'text', name:'name', id:'mo_name', label:'Full Name', required:true, readonly:true, value: (profile && (profile.displayName || profile.name)) || '' }));

    // Single email field — where the subscription is delivered
    wrap.appendChild(renderText({ type:'email', name:'proapp_email', id:'mo_email', label:'Subscription Email Address', required:true, placeholder:'your@email.com', value: (profile && profile.email) || '' }));

    return wrap;
  }

  /* ── main render ──────────────────────────────────────────── */
  function render() {
    if (!active) return;
    const def = active.def;

    $('checkoutTitle').textContent = def.title;
    $('checkoutSubtitle').textContent = def.sub;
    document.title = def.title + ' — Checkout | RabbiHossainLTD';
    const photo = $('checkoutPhoto');
    if (photo) { photo.src = '/images/service-cards/' + (IMG_OVERRIDE[active.slug] || active.slug) + '.png'; photo.alt = def.title; }
    renderInfo(def);

    const root = $('schemaRoot');
    root.innerHTML = '';

    if (def.fields === 'ff') {
      root.appendChild(renderFF());
    } else if (def.fields === 'proapp') {
      root.appendChild(renderProapp(def));
    } else {
      schemaFor(def).forEach(f => {
        if (typeof f.showWhen === 'function' && !f.showWhen()) return;   // conditional fields (e.g. card delivery address)
        if (f.type === 'options') root.appendChild(renderOptions(f));
        else if (f.type === 'toggle') root.appendChild(renderToggle(f));
        else if (f.type === 'textarea') root.appendChild(renderTextarea(f));
        else if (f.type === 'select') root.appendChild(renderSelect(f));
        else root.appendChild(renderText(f));
      });
    }

    // engine-aligned hidden input for card price (USD, numeric for catalog)
    if (def.fields === 'card') {
      const hu = document.createElement('input');
      hu.type = 'hidden'; hu.id = 'mo_card_price_usd'; hu.name = 'card_price_usd';
      root.appendChild(hu);
      const chosen = sel['card_price_package'];
      if (chosen) {
        const t = sel['card_type'] || 'Physical';
        const arr = CARD_PRICE_OPTIONS[t] || [];
        const opt = arr.map(p => ({ id: t.toLowerCase() + '_' + p, price: p })).find(o => o.id === chosen);
        if (opt) hu.value = opt.price;
      }
    }

    syncPrices();
  }

  /* ── boot ─────────────────────────────────────────────────── */
  function mountEngine() {
    // Let service-modal.js own the payment panel + amount state.
    if (typeof window.rhMountCheckout === 'function') {
      window.rhMountCheckout({ serviceName: active.def.name, fieldsType: active.def.fields || '', proapp: active.def.proapp || '' });
    }
  }

  function show(id) {
    ['checkoutLoading','checkoutInvalid','checkoutAuthGate','checkoutMain'].forEach(x => { const el = $(x); if (el) el.style.display = (x === id) ? '' : 'none'; });
  }

  function start() {
    show('checkoutMain');
    render();
    mountEngine();
    // keep header/sticky price in sync while the engine updates amounts
    if (window.MutationObserver) {
      const src = $('servicePriceUsd');
      if (src) new MutationObserver(syncPrices).observe(src, { childList: true, characterData: true, subtree: true });
    }
    document.addEventListener('change', () => setTimeout(syncPrices, 60));
    // sticky "Pay Now" — triggers the SELECTED payment method
    const sticky = $('stickyPayBtn');
    if (sticky && !sticky._wired) {
      sticky._wired = true;
      sticky.addEventListener('click', () => {
        if (typeof window.rhPayNow === 'function') window.rhPayNow();
        else { const p = $('serviceCheckoutPanel'); if (p) p.scrollIntoView({ behavior:'smooth', block:'center' }); }
      });
    }

    // "Add to cart" — snapshot the configured order into the cart
    const cartBtn = $('addToCartBtn');
    if (cartBtn && !cartBtn._wired) {
      cartBtn._wired = true;
      cartBtn.addEventListener('click', () => {
        if (!active) return;
        const amountUsd = (typeof window.rhGetServiceAmount === 'function')
          ? (window.rhGetServiceAmount() || 0)
          : (parseFloat(($('headerPriceUsd') && $('headerPriceUsd').textContent.replace(/[^0-9.]/g, '')) || 0) || 0);
        if (!amountUsd || amountUsd < 0.1) {
          showToast('Select a package/variant first');
          return;
        }
        const details = (typeof window.rhCollectFormData === 'function') ? window.rhCollectFormData() : {};
        const item = {
          slug: active.slug,
          title: active.def.title,
          image: '/images/service-cards/' + (IMG_OVERRIDE[active.slug] || active.slug) + '.png',
          amountUsd: amountUsd,
          serviceName: active.def.name,
          serviceId: active.def.fields || '',
          details: details
        };
        if (window.RhCart && window.rhSetCartConfigured) {
          window.rhSetCartConfigured(item);
          showToast('Added to cart');
          if (EMBED) {
            try { window.parent.postMessage({ __rh: 'cart-configured', slug: active.slug }, '*'); } catch (e) {}
          }
        } else if (window.RhCart && window.RhCart.add) {
          const n = window.RhCart.add(item);
          showToast('Added to cart (' + n + ')');
        } else {
          showToast('Cart unavailable — please refresh');
        }
      });
    }
  }

  // tiny toast (checkout page)
  function showToast(msg) {
    let t = document.getElementById('rhCxToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'rhCxToast';
      t.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:9999;background:#fff;color:#0a0a0a;font-weight:800;font-size:.82rem;padding:11px 18px;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.4);opacity:0;transition:opacity .22s;pointer-events:none;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._h);
    t._h = setTimeout(() => { t.style.opacity = '0'; }, 2200);
  }

  function init() {
    const target = resolveTarget();
    if (!target) { show('checkoutInvalid'); return; }
    active = target;

    if (EMBED) {
      document.body.classList.add('cx-embed');
      const sp = $('stickyPayBtn');
      if (sp) sp.style.display = 'none';
      const ac = $('addToCartBtn');
      if (ac && !ac.querySelector('.cx-cart-label')) {
        const lbl = document.createElement('span');
        lbl.className = 'cx-cart-label';
        lbl.textContent = 'Save to Cart';
        ac.appendChild(lbl);
      }
    }

    const p = new URLSearchParams(window.location.search);
    if ((p.get('service') || '').toLowerCase() !== active.slug) {
      try { history.replaceState(null, '', window.location.origin + '/checkout/?service=' + encodeURIComponent(active.slug)); } catch (e) {}
    }

    let started = false;
    function loggedIn() { return !!(window.rabbiAuth && typeof window.rabbiAuth.isLoggedIn === 'function' && window.rabbiAuth.isLoggedIn()); }
    function hasCached() { try { const u = JSON.parse(localStorage.getItem('rh_user_cache') || 'null'); return !!(u && u.uid); } catch (e) { return false; } }
    function open() { if (started) return; started = true; start(); }

    if (loggedIn() || hasCached()) open();
    let tries = 30;
    (function settle() {
      if (loggedIn()) { open(); return; }
      if (tries-- > 0) { setTimeout(settle, 150); return; }
      if (!loggedIn()) {
        started = false;
        show('checkoutAuthGate');
        const el = $('checkoutAuthGateService');
        if (el) el.textContent = active.def.title + ' to complete your order.';
        const btn = $('checkoutLoginBtn');
        if (btn && !btn._wired) { btn._wired = true; btn.addEventListener('click', () => { window.rabbiAuth && window.rabbiAuth.openLogin && window.rabbiAuth.openLogin('checkout'); }); }
      }
    })();
    window.addEventListener('rabbi:loggedin', open);
    window.addEventListener('rabbi:loggedout', () => { if (hasCached()) return; started = false; show('checkoutAuthGate'); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
