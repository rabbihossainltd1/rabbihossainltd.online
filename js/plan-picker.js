/* ============================================================
   Shared plan-picker popup
   ------------------------------------------------------------
   Opens a small modal to pick a plan, then adds / updates the
   cart. Used from product-card cart buttons (home + services)
   and from the cart page "Choose plan" button. Never navigates
   to the full checkout page.
   ============================================================ */
(function () {
  'use strict';

  var I4G_URL = 'https://rabbi-backend-vlr7.onrender.com/api/item4gamer/products?category_id=19';

  function rh() { return window.RH_PLANS || {}; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function moneyUsd(v) {
    if (window.RhCart && window.RhCart.formatUsd) return window.RhCart.formatUsd(v);
    return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function moneyBdt(v) {
    if (window.RhCart && window.RhCart.formatBdt) return window.RhCart.formatBdt(v);
    return '৳' + Math.round(Number(v || 0) * 125).toLocaleString('en-BD');
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
  function svc(slug) {
    var s = rh().SERVICES;
    return s ? s[slug] : null;
  }

  function planKind(item) {
    var s = svc(item.slug);
    if (item.proapp || (s && s.proapp)) return 'proapp';
    if (s && s.fields === 'card') return 'card';
    if (s && s.fields === 'meta') return 'meta';
    if (s && s.fields === 'ff') return 'ff';
    if (s && s.fields && s.fields.indexOf('ff') === 0) return 'ffPanel';
    if (s && rh().FIXED_PRICES && rh().FIXED_PRICES[item.slug]) return 'simple';
    return 'simple';
  }

  function syncOptions(item, kind) {
    if (kind === 'proapp') {
      var appId = item.proapp || item.slug;
      var app = (rh().APPS || []).find(function (a) { return a.id === appId; });
      if (!app) return [];
      return app.plans.map(function (p) {
        return { key: p.label, label: p.label, usd: p.usd };
      });
    }
    if (kind === 'ffPanel') {
      var s = svc(item.slug);
      var v = s && (rh().FF_VARIANTS || {})[s.fields];
      if (!v) return [];
      return v.rows.map(function (r) { return { key: r[0], label: r[0], usd: r[2] }; });
    }
    if (kind === 'card') {
      var out = [];
      var prices = rh().CARD_PRICE_OPTIONS || { Physical: [110, 550, 1200], Virtual: [12, 55, 105] };
      ['Physical', 'Virtual'].forEach(function (t) {
        (prices[t] || []).forEach(function (p) {
          out.push({ key: t + '|' + p, label: t + ' Card — $' + Number(p).toLocaleString('en-US'), usd: p, cardType: t });
        });
      });
      return out;
    }
    if (kind === 'meta') {
      return (rh().META_OPTIONS || []).map(function (o) {
        return { key: o.key, label: o.label, usd: o.usd };
      });
    }
    if (kind === 'simple') {
      var price = (rh().FIXED_PRICES || {})[item.slug];
      if (!price) return [];
      var def = svc(item.slug);
      return [{ key: 'standard', label: (def && def.title) || item.title || 'Standard', usd: price }];
    }
    return [];
  }

  function currentPlanKey(item, kind) {
    if (!item || item.needsPlan || !item.details) return '';
    var d = item.details;
    if (kind === 'proapp') return d.plan_type || '';
    if (kind === 'meta') return d.meta_type || '';
    if (kind === 'card') {
      var t = d.card_type || '';
      var p = d.card_price_usd || d.card_price_package || '';
      return t && p ? (t + '|' + p) : '';
    }
    if (kind === 'ffPanel') {
      var s = svc(item.slug);
      var v = s && (rh().FF_VARIANTS || {})[s.fields];
      return v ? (d[v.name] || '') : '';
    }
    if (kind === 'ff') return d.productId || d.item4gamerProductId || d.packageName || '';
    return d.plan_type || 'standard';
  }

  function buildDetails(item, kind, opt) {
    var user = userInfo();
    var d = {
      service_type: item.serviceName || (svc(item.slug) && svc(item.slug).name) || '',
      _amount_usd: opt.usd,
      source_page: 'plan-picker'
    };
    if (kind === 'proapp') {
      var app = (rh().APPS || []).find(function (a) { return a.id === (item.proapp || item.slug); });
      d.app_name = app ? app.name : '';
      d.plan_type = opt.key;
      d.plan_usd = String(opt.usd);
      d.name = user.name;
      d.proapp_email = user.email;
    } else if (kind === 'ffPanel') {
      var s = svc(item.slug);
      var v = s && (rh().FF_VARIANTS || {})[s.fields];
      if (v) {
        d[v.name] = opt.key;
        d[v.email] = user.email;
      }
    } else if (kind === 'card') {
      d.card_type = opt.cardType || String(opt.key).split('|')[0];
      d.card_price_package = String(opt.usd);
      d.card_price_usd = opt.usd;
    } else if (kind === 'meta') {
      d.meta_type = opt.key;
    } else if (kind === 'ff') {
      var extra = opt.extra || {};
      d.provider = 'item4gamer';
      d.packageName = extra.productName || opt.label;
      d.productName = extra.productName || opt.label;
      d.productId = extra.productId || opt.key;
      d.product_id = extra.productId || opt.key;
      d.variationId = extra.variationId || extra.productId || opt.key;
      d.item4gamerProductId = extra.item4gamerProductId || extra.productId || opt.key;
      d.isMembership = !!extra.isMembership;
      d.autoTopupReady = true;
      d.gameId = 'freefire';
      d.amountUsd = opt.usd;
    } else {
      d.plan_type = opt.key;
    }
    return d;
  }

  function injectCss() {
    if (document.getElementById('rhPlanPickerCss')) return;
    var s = document.createElement('style');
    s.id = 'rhPlanPickerCss';
    s.textContent = [
      '#rhGlobalPlanModal{position:fixed;inset:0;z-index:12050}',
      '#rhGlobalPlanModal[hidden]{display:none!important}',
      '#rhGlobalPlanModal .rh-pp-back{position:absolute;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(8px)}',
      '#rhGlobalPlanModal .rh-pp-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,calc(100vw - 24px));max-height:min(72vh,560px);display:flex;flex-direction:column;background:#101010;border:1px solid rgba(255,255,255,.16);border-radius:20px;overflow:hidden;box-shadow:0 28px 80px rgba(0,0,0,.55)}',
      '#rhGlobalPlanModal .rh-pp-head{flex:none;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:16px 16px 12px;border-bottom:1px solid rgba(255,255,255,.1)}',
      '#rhGlobalPlanModal .rh-pp-title{font-weight:850;font-size:.98rem;color:#f5f5f3;line-height:1.3}',
      '#rhGlobalPlanModal .rh-pp-sub{margin-top:4px;font-size:.76rem;color:#8b8b87;font-weight:600}',
      '#rhGlobalPlanModal .rh-pp-close{width:34px;height:34px;flex:none;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:transparent;color:#e2e2df;font-size:.95rem;cursor:pointer}',
      '#rhGlobalPlanModal .rh-pp-body{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}',
      '#rhGlobalPlanModal .rh-pp-opt{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;border:1px solid rgba(255,255,255,.14);background:#161616;border-radius:13px;padding:12px 14px;cursor:pointer;text-align:left;font-family:inherit}',
      '#rhGlobalPlanModal .rh-pp-opt:hover{border-color:rgba(255,255,255,.4)}',
      '#rhGlobalPlanModal .rh-pp-opt.sel{border-color:#fff;background:rgba(255,255,255,.08)}',
      '#rhGlobalPlanModal .rh-pp-opt .lbl{font-size:.86rem;font-weight:750;color:#f5f5f3}',
      '#rhGlobalPlanModal .rh-pp-opt .p{font-size:.88rem;font-weight:850;color:#f5f5f3;text-align:right}',
      '#rhGlobalPlanModal .rh-pp-opt .p small{display:block;font-size:.68rem;color:#8b8b87;font-weight:600}',
      '#rhGlobalPlanModal .rh-pp-empty{padding:22px 8px;text-align:center;color:#8b8b87;font-size:.86rem;line-height:1.55}',
      '#rhGlobalPlanModal .rh-pp-load{display:flex;align-items:center;justify-content:center;gap:10px;padding:22px;color:#8b8b87;font-size:.86rem;font-weight:700}',
      '#rhGlobalPlanModal .rh-pp-spin{width:16px;height:16px;border:2px solid rgba(255,255,255,.2);border-top-color:#fff;border-radius:50%;animation:rhPpSpin .7s linear infinite}',
      '@keyframes rhPpSpin{to{transform:rotate(360deg)}}',
      'html[data-theme="light"] #rhGlobalPlanModal .rh-pp-card{background:#fff;border-color:rgba(0,0,0,.12);box-shadow:0 28px 80px rgba(0,0,0,.18)}',
      'html[data-theme="light"] #rhGlobalPlanModal .rh-pp-head{border-bottom-color:rgba(0,0,0,.08)}',
      'html[data-theme="light"] #rhGlobalPlanModal .rh-pp-title{color:#161616}',
      'html[data-theme="light"] #rhGlobalPlanModal .rh-pp-sub{color:#6f6f6c}',
      'html[data-theme="light"] #rhGlobalPlanModal .rh-pp-close{border-color:rgba(0,0,0,.16);color:#2a2a2a}',
      'html[data-theme="light"] #rhGlobalPlanModal .rh-pp-opt{background:#fafafa;border-color:rgba(0,0,0,.12)}',
      'html[data-theme="light"] #rhGlobalPlanModal .rh-pp-opt:hover{border-color:#111}',
      'html[data-theme="light"] #rhGlobalPlanModal .rh-pp-opt.sel{background:#111;border-color:#111}',
      'html[data-theme="light"] #rhGlobalPlanModal .rh-pp-opt .lbl{color:#161616}',
      'html[data-theme="light"] #rhGlobalPlanModal .rh-pp-opt .p{color:#161616}',
      'html[data-theme="light"] #rhGlobalPlanModal .rh-pp-opt.sel .lbl,html[data-theme="light"] #rhGlobalPlanModal .rh-pp-opt.sel .p{color:#fff}',
      'html[data-theme="light"] #rhGlobalPlanModal .rh-pp-opt.sel .p small{color:#cfcfcf}',
      'html[data-theme="light"] #rhGlobalPlanModal .rh-pp-empty,html[data-theme="light"] #rhGlobalPlanModal .rh-pp-load{color:#6f6f6c}',
      'html[data-theme="light"] #rhGlobalPlanModal .rh-pp-spin{border-color:rgba(0,0,0,.15);border-top-color:#111}'
    ].join('');
    document.head.appendChild(s);
  }

  function ensureModal() {
    injectCss();
    var el = document.getElementById('rhGlobalPlanModal');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'rhGlobalPlanModal';
    el.hidden = true;
    el.innerHTML =
      '<div class="rh-pp-back" data-pp-close></div>' +
      '<div class="rh-pp-card" role="dialog" aria-modal="true" aria-labelledby="rhPpTitle">' +
        '<div class="rh-pp-head">' +
          '<div><div class="rh-pp-title" id="rhPpTitle">Choose plan</div><div class="rh-pp-sub" id="rhPpSub">Select a plan to add it to your cart.</div></div>' +
          '<button type="button" class="rh-pp-close" data-pp-close aria-label="Close">✕</button>' +
        '</div>' +
        '<div class="rh-pp-body" id="rhPpBody"></div>' +
      '</div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-pp-close]')) close();
    });
    return el;
  }

  var _onDone = null;
  var _lock = false;

  function close() {
    var el = document.getElementById('rhGlobalPlanModal');
    if (el) el.hidden = true;
    document.body.style.overflow = '';
    _lock = false;
  }

  function renderOptions(body, options, curKey, onPick) {
    if (!options.length) {
      body.innerHTML = '<div class="rh-pp-empty">No plans available for this product.</div>';
      return;
    }
    body.innerHTML = options.map(function (o) {
      var sel = String(o.key) === String(curKey) ? ' sel' : '';
      return '<button type="button" class="rh-pp-opt' + sel + '" data-key="' + esc(o.key) + '">' +
        '<span class="lbl">' + esc(o.label) + '</span>' +
        '<span class="p">' + moneyUsd(o.usd) + '<small>' + moneyBdt(o.usd) + '</small></span>' +
      '</button>';
    }).join('');
    body.querySelectorAll('.rh-pp-opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-key');
        var opt = options.find(function (o) { return String(o.key) === String(key); });
        if (opt) onPick(opt);
      });
    });
  }

  function commit(item, kind, opt) {
    var configured = {
      slug: item.slug,
      title: item.title,
      image: item.image,
      amountUsd: opt.usd,
      serviceName: item.serviceName || (svc(item.slug) ? svc(item.slug).name : ''),
      serviceId: item.serviceId || (svc(item.slug) ? svc(item.slug).fields : ''),
      proapp: item.proapp || '',
      details: buildDetails(item, kind, opt)
    };
    if (item.id && !item.needsPlan && window.rhReplaceCartItem) {
      window.rhReplaceCartItem(item.id, configured);
      if (window.rhCartToast) window.rhCartToast('Plan updated');
    } else if (window.rhSetCartConfigured) {
      window.rhSetCartConfigured(configured);
      if (window.rhCartToast) window.rhCartToast('Added to cart');
    } else if (window.RhCart && window.RhCart.add) {
      window.RhCart.add(configured);
      if (window.rhCartToast) window.rhCartToast('Added to cart');
    }
    close();
    if (typeof _onDone === 'function') _onDone(configured);
  }

  function unwrapProducts(raw) {
    if (!raw) return [];
    var cands = [raw && raw.data && raw.data.data && raw.data.data.products, raw && raw.data && raw.data.products, raw && raw.data && raw.data.data, raw && raw.data, raw && raw.products, raw];
    for (var i = 0; i < cands.length; i++) {
      if (Array.isArray(cands[i]) && cands[i].length) return cands[i];
    }
    return [];
  }

  function normalizeFf(p) {
    var id = String(p.variationId != null ? p.variationId : (p.variation_id != null ? p.variation_id : (p.id != null ? p.id : (p.productId || p.product_id || '')))).trim();
    var fields = ['amountUsd', 'amountUSD', 'providerPriceUsd', 'price', 'sale_price', 'selling_price', 'usd', 'priceUsd'];
    var usd = null;
    for (var i = 0; i < fields.length; i++) {
      var n = parseFloat(String(p[fields[i]] == null ? '' : p[fields[i]]).replace(/[^0-9.]/g, ''));
      if (Number.isFinite(n) && n > 0) { usd = n; break; }
    }
    if (!usd) return null;
    var name = String(p.productName || p.product_name || p.name || p.title || 'Package').trim();
    var isMem = id === '155344' || id === '155345' || String(p.type || '').toLowerCase() === 'membership';
    return {
      key: id || name,
      label: name + (isMem ? ' (Membership)' : ''),
      usd: usd,
      extra: {
        productId: id,
        item4gamerProductId: id,
        variationId: id,
        productName: name,
        isMembership: isMem,
        amountUsd: usd
      }
    };
  }

  async function loadFfOptions() {
    if (window.Item4Gamer && typeof window.Item4Gamer.fetchProducts === 'function') {
      var list = await window.Item4Gamer.fetchProducts();
      return (list || []).map(function (p) {
        return {
          key: p.productId || p.item4gamerProductId || p.productName,
          label: p.productName + (p.isMembership ? ' (Membership)' : ''),
          usd: p.amountUsd,
          extra: p
        };
      }).filter(function (o) { return o.usd > 0; });
    }
    var res = await fetch(I4G_URL, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error('ff-load');
    var raw = await res.json();
    return unwrapProducts(raw).map(normalizeFf).filter(Boolean);
  }

  function open(item, opts) {
    if (!item || !item.slug) return;
    opts = opts || {};
    _onDone = opts.onDone || null;
    var modal = ensureModal();
    var body = document.getElementById('rhPpBody');
    var title = document.getElementById('rhPpTitle');
    var sub = document.getElementById('rhPpSub');
    if (title) title.textContent = item.title || 'Choose plan';
    if (sub) sub.textContent = 'Select a plan to add it to your cart.';
    var kind = planKind(item);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    function pick(opt) {
      if (_lock) return;
      _lock = true;
      commit(item, kind, opt);
    }

    if (kind === 'ff') {
      body.innerHTML = '<div class="rh-pp-load"><span class="rh-pp-spin"></span>Loading live prices…</div>';
      loadFfOptions().then(function (options) {
        renderOptions(body, options, currentPlanKey(item, kind), pick);
      }).catch(function () {
        body.innerHTML = '<div class="rh-pp-empty">Could not load packages. Try again.</div>';
      });
      return;
    }

    renderOptions(body, syncOptions(item, kind), currentPlanKey(item, kind), pick);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });

  window.RhPlanPicker = { open: open, close: close };
})();
