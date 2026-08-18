/* ============================================================
   RabbiHossainLTD — Cart (localStorage-backed)
   ------------------------------------------------------------
   A lightweight client cart. Items are snapshots of an order the
   customer configured on the checkout page (service + plan/price
   + all form details). The cart lives in localStorage so it
   survives navigation; actual checkout still requires login and
   goes through the normal backend endpoints.
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'rh_cart';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch (e) { return []; }
  }
  function write(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); }
    catch (e) {}
  }
  function uid() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function bdt(v) { return '৳' + Math.round(Number(v || 0) * 125).toLocaleString('en-BD'); }
  function usd(v) { return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  window.RhCart = {
    get: read,
    count: function () { return read().length; },
    totalUsd: function (items) {
      return (items || read()).reduce(function (s, i) { return s + (Number(i.amountUsd) || 0); }, 0);
    },
    add: function (item) {
      var items = read();
      // Replace an existing identical entry (same slug + same details) instead of duplicating.
      var dup = items.find(function (x) {
        return x.slug === item.slug && JSON.stringify(x.details || {}) === JSON.stringify(item.details || {});
      });
      if (dup) {
        dup.qty = (dup.qty || 1) + 1;
      } else {
        item.id = uid();
        item.qty = 1;
        item.addedAt = Date.now();
        items.push(item);
      }
      write(items);
      return items.length;
    },
    remove: function (id) {
      write(read().filter(function (x) { return x.id !== id; }));
    },
    removeMany: function (ids) {
      var set = {};
      ids.forEach(function (i) { set[i] = 1; });
      write(read().filter(function (x) { return !set[x.id]; }));
    },
    setQty: function (id, qty) {
      var items = read();
      items.forEach(function (x) { if (x.id === id) x.qty = Math.max(1, Number(qty) || 1); });
      write(items);
    },
    clear: function () { write([]); },
    formatBdt: bdt,
    formatUsd: usd
  };

  // ── Quick add-to-cart from product cards (no plan selected yet) ──
  // Maps a service signature to its checkout slug. Mirrors service-modal.js CHECKOUT_SLUGS.
  var SLUG_MAP = {
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

  window.rhCartSlugFor = function (service, fields, proapp) {
    if (proapp) return proapp;              // premium apps keyed by app id
    return SLUG_MAP[service + '|' + (fields || '')] || '';
  };

  // Add a "draft" item (no plan/price yet). Plan is chosen from the cart later.
  window.rhAddToCartDraft = function (payload) {
    var items = read();
    var existing = items.find(function (x) { return x.slug === payload.slug && x.needsPlan; });
    if (existing) {
      existing.qty = (existing.qty || 1) + 1;
    } else {
      items.push({
        id: uid(),
        slug: payload.slug,
        title: payload.title,
        image: payload.image,
        serviceName: payload.serviceName,
        serviceId: payload.serviceId,
        proapp: payload.proapp || '',
        needsPlan: true,
        amountUsd: 0,
        details: {},
        qty: 1,
        addedAt: Date.now()
      });
    }
    write(items);
    notify();
    return items.length;
  };

  // Replace any draft (needsPlan) item of this slug with a configured item;
  // otherwise dedup on identical details like a normal add.
  window.rhSetCartConfigured = function (item) {
    var items = read();
    var idx = items.findIndex(function (x) { return x.slug === item.slug && x.needsPlan; });
    if (idx >= 0) {
      item.id = items[idx].id;
      item.qty = items[idx].qty || 1;
      items[idx] = item;
    } else {
      var dup = items.find(function (x) {
        return x.slug === item.slug && !x.needsPlan && JSON.stringify(x.details || {}) === JSON.stringify(item.details || {});
      });
      if (dup) dup.qty = (dup.qty || 1) + 1;
      else { item.id = uid(); item.qty = 1; item.addedAt = Date.now(); items.push(item); }
    }
    write(items);
    notify();
  };

  // Replace an existing (configured) item by id — used by the cart's
  // "Change plan" so the plan updates in place instead of duplicating.
  window.rhReplaceCartItem = function (id, item) {
    var items = read();
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        item.id = id;
        item.qty = items[i].qty || 1;
        items[i] = item;
        break;
      }
    }
    write(items);
    notify();
  };

  // Tiny toast (works on any page).
  window.rhCartToast = function (msg) {
    var t = document.getElementById('rhCartToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'rhCartToast';
      t.style.cssText = 'position:fixed;left:50%;bottom:92px;transform:translateX(-50%);z-index:99999;background:#fff;color:#0a0a0a;font-weight:800;font-size:.82rem;padding:11px 18px;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.4);opacity:0;transition:opacity .22s;pointer-events:none;max-width:90vw;text-align:center;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.style.opacity = '0'; }, 2200);
  };

  // Delegated handler for product-card cart buttons (`.svc-cart-btn`).
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.svc-cart-btn');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();

    var card = btn.closest('.service-card, .compact-service-card, .home-svc-card');
    var applyBtn = card ? card.querySelector('.service-apply-btn') : null;
    var service = (applyBtn && applyBtn.dataset.service) || (card && card.dataset.service) || btn.dataset.service || '';
    var fields = (applyBtn && applyBtn.dataset.fields) || (card && card.dataset.fields) || btn.dataset.fields || '';
    var proapp = (applyBtn && applyBtn.dataset.proapp) || (card && card.dataset.proapp) || btn.dataset.proapp || '';

    var slug = window.rhCartSlugFor(service, fields, proapp);
    if (!slug) { window.rhCartToast('Unable to add this item'); return; }

    var img = card ? card.querySelector('.service-card-img img, img') : null;
    var h3 = card ? card.querySelector('h3') : null;
    var name = (h3 && h3.textContent.trim()) || (img && img.getAttribute('alt')) || (proapp || service);

    var draft = {
      slug: slug,
      title: name,
      image: img ? img.getAttribute('src') : ('/images/service-cards/' + slug + '.png'),
      serviceName: service,
      serviceId: fields,
      proapp: proapp,
      needsPlan: true
    };
    if (window.RhPlanPicker && typeof window.RhPlanPicker.open === 'function') {
      window.RhPlanPicker.open(draft);
      return;
    }
    window.rhAddToCartDraft(draft);
    window.rhCartToast('Added to cart');
  }, true);

  // Emit a small event so any open cart UI can refresh.
  function notify() {
    try { window.dispatchEvent(new CustomEvent('rh:cart', { detail: read() })); } catch (e) {}
  }
  var _origAdd = window.RhCart.add;
  window.RhCart.add = function (item) { var n = _origAdd(item); notify(); return n; };
  var _origRemove = window.RhCart.remove;
  window.RhCart.remove = function (id) { _origRemove(id); notify(); };
  var _origRemoveMany = window.RhCart.removeMany;
  window.RhCart.removeMany = function (ids) { _origRemoveMany(ids); notify(); };
  var _origClear = window.RhCart.clear;
  window.RhCart.clear = function () { _origClear(); notify(); };
})();
