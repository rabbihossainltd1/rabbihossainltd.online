/* ============================================================
   Item4Gamer Integration — v3.0
   - Products load instantly from backend cache (no wait)
   - Player ID verification required before submit
   - Membership: Weekly (155344), Monthly (155345)
   - All calls → backend only, no direct Item4Gamer API
   ============================================================ */

(function () {
  'use strict';

  const BACKEND_BASE           = 'https://rabbi-backend-vlr7.onrender.com';
  const FF_CATEGORY_ID         = 19;
  const BDT_FALLBACK_RATE      = 125;
  const MEMBERSHIP_IDS         = new Set(['155344', '155345']);

  // Global player verify state — checked by service-modal before submit
  window._i4gPlayerVerified    = false;
  window._i4gVerifiedUid       = null;
  window._i4gVerifiedName      = null;

  /* ── Safe price extraction ─────────────────────────────── */
  const PRICE_FIELDS = [
    'amountUsd','amountUSD','providerPriceUsd',
    'price','sale_price','selling_price','regular_price',
    'final_price','amount','amount_usd','usd','usd_price',
    'cost','price_usd','priceUsd','unit_price','reseller_price','rate'
  ];

  function extractPrice(obj) {
    if (!obj) return null;
    for (const f of PRICE_FIELDS) {
      const raw = obj[f];
      if (raw === undefined || raw === null || raw === '') continue;
      const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  }

  function extractId(p) {
    return String(p.variationId ?? p.variation_id ?? p.id ?? p.productId ?? p.product_id ?? '').trim();
  }

  /* ── Unwrap products from any response envelope ────────── */
  function unwrapProducts(raw) {
    if (!raw) return [];
    const cands = [
      raw?.data?.data?.products, raw?.data?.products,
      raw?.data?.data, raw?.data, raw?.products, raw
    ];
    for (const c of cands) {
      if (Array.isArray(c) && c.length > 0) return c;
    }
    return [];
  }

  /* ── Normalize a product from backend response ─────────── */
  function normalizeProduct(p) {
    const productId    = extractId(p);
    const amountUsd    = extractPrice(p);
    const amountBDT    = p.amountBDT ?? p.amountBdt ??
                         (amountUsd !== null ? Math.round(amountUsd * BDT_FALLBACK_RATE) : null);
    const name         = String(p.productName ?? p.product_name ?? p.name ?? p.title ?? 'Unknown Package').trim();
    const isMembership = MEMBERSHIP_IDS.has(productId) ||
                         String(p.type || '').toLowerCase() === 'membership' ||
                         /weekly|monthly/i.test(name);
    const hasPrice     = amountUsd !== null && amountUsd > 0;

    if (!hasPrice) {
      console.warn(`[Item4Gamer] No price for "${name}" (id:${productId}) — skipped`);
    }

    return {
      item4gamerProductId: productId,
      productId,
      variationId:    productId,
      productName:    name,
      amountUsd,
      amountBDT,
      provider:       'item4gamer',
      autoTopupReady: !!productId,
      type:           p.type || (isMembership ? 'membership' : 'diamonds'),
      isMembership,
      membershipType: p.membershipType || null,
      region:         p.region || null,
      diamonds:       p.diamonds || null,
      hasPrice,
      _raw: p
    };
  }

  const LS_PRODUCTS = 'rh_ff_products_v1';

  function saveLocalProducts(products) {
    try { localStorage.setItem(LS_PRODUCTS, JSON.stringify({ t: Date.now(), products })); } catch (e) {}
  }
  function loadLocalProducts() {
    try {
      const d = JSON.parse(localStorage.getItem(LS_PRODUCTS) || 'null');
      if (!d || !Array.isArray(d.products) || !d.products.length) return [];
      if (Date.now() - Number(d.t || 0) > 72 * 3600 * 1000) return [];
      return d.products.filter(p => p && p.hasPrice && Number(p.amountUsd) > 0);
    } catch (e) { return []; }
  }

  /* ── Fetch products from backend cache (instant) ───────── */
  async function fetchProducts() {
    const url = `${BACKEND_BASE}/api/item4gamer/products?category_id=${FF_CATEGORY_ID}`;
    let res;
    try {
      res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      const local = loadLocalProducts();
      if (local.length) return local;
      throw new Error('Network error loading products. Please try again.');
    }
    if (!res.ok) {
      const local = loadLocalProducts();
      if (local.length) return local;
      throw new Error(`Backend HTTP ${res.status} fetching products.`);
    }

    let raw;
    try { raw = await res.json(); } catch (e) { throw new Error('Invalid JSON from backend.'); }

    const list = unwrapProducts(raw);
    const products = list
      .map(p => normalizeProduct(p))
      .filter(p => {
        if (!p.hasPrice) return false;
        return true;
      });
    if (products.length) saveLocalProducts(products);
    else {
      const local = loadLocalProducts();
      if (local.length) return local;
    }
    return products;
  }

  /* ── Check player via backend ──────────────────────────── */
  const REGION_ORDER = ['Bangladesh','Indonesia','Singapore','Malaysia','Thailand','Vietnam','India','Pakistan','MENA','Taiwan','Brazil','LATAM','Europe','Global'];
  const GK_CODE = {
    Bangladesh: 'BD', Indonesia: 'ID', Singapore: 'SG', India: 'IND',
    Pakistan: 'PK', Brazil: 'BR', LATAM: 'SAC'
  };
  const CODE_TO_REGION = {
    BD: 'Bangladesh', IND: 'India', IN: 'India', ID: 'Indonesia',
    SG: 'Singapore', BR: 'Brazil', PK: 'Pakistan', SAC: 'LATAM', MY: 'Malaysia',
    TH: 'Thailand', VN: 'Vietnam', TW: 'Taiwan'
  };
  let selectedRegion = 'Bangladesh';

  function regionOf(p) {
    return String(p.region || '').trim() || 'Other';
  }

  function shortPackName(p) {
    let n = String(p.productName || '');
    n = n.replace(/^Free Fire Diamonds\s*-\s*[^,]+,\s*/i, '');
    n = n.replace(/^Free Fire\s+/i, '');
    return n.trim() || p.productName;
  }

  function parseFFX(data) {
    if (!data || typeof data !== 'object') return null;
    if (data.error && !data.AccountInfo && !(data.data && data.data.AccountInfo)) return null;
    const body = (data.AccountInfo || data.accountInfo) ? data : (data.data || data);
    const acc = body.AccountInfo || body.accountInfo || {};
    const name = String(acc.AccountName || acc.accountName || body.playerName || body.name || body.nickname || '').trim();
    if (!name && !acc.AccountRegion && !acc.AccountLevel) return null;
    return {
      ok: true,
      playerName: name || 'Verified',
      server: acc.AccountRegion || acc.accountRegion || body.server || body.region || '',
      extra: body
    };
  }

  async function checkPlayer(uid) {
    const id = String(uid || '').trim();
    if (!id) return { ok: false, error: 'UID is empty.' };
    const uidEnc = encodeURIComponent(id);
    const urls = [
      `${BACKEND_BASE}/api/item4gamer/ff-info?uid=${uidEnc}`,
      `${BACKEND_BASE}/api/item4gamer/check-player?uid=${uidEnc}&game=freefire`,
      `https://api.gameskinbo.com/ff-info/get?uid=${uidEnc}`
    ];
    let lastSoft = null;
    for (let i = 0; i < urls.length; i++) {
      try {
        const res = await fetch(urls[i], { method: 'GET', headers: { Accept: 'application/json' } });
        const data = await res.json().catch(() => ({}));
        const parsed = parseFFX(data);
        if (parsed) return parsed;
        if (res.status === 402 || data.error === 'PLAYER_NOT_FOUND') {
          return { ok: false, error: 'এই UID খুঁজে পাওয়া যায়নি। নম্বরটা আবার দেখুন।' };
        }
        if (res.status === 429 || res.status === 503 || res.status === 401) {
          lastSoft = { ok: false, error: '', soft: true };
          continue;
        }
      } catch (e) {
        lastSoft = { ok: false, error: '', soft: true };
      }
    }
    return lastSoft || { ok: false, error: '', soft: true };
  }

  /* ── SVG icons ──────────────────────────────────────────── */
  function diamondSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" style="width:17px;height:17px;display:block">
      <path d="M6 4h12l4 6-10 10L2 10l4-6Z" fill="currentColor" opacity=".22"/>
      <path d="M2 10h20M6 4l3 6 3-6 3 6 3-6M9 10l3 10 3-10" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`;
  }
  function membershipSVG() {
    return `<svg viewBox="0 0 24 24" fill="none" style="width:17px;height:17px;display:block">
      <rect x="3" y="5" width="18" height="14" rx="3" fill="currentColor" opacity=".16" stroke="currentColor" stroke-width="1.7"/>
      <path d="M3 10h18M7 15h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M17 14l1 2 2 .3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1L14 16.3l2-.3 1-2Z" fill="currentColor"/>
    </svg>`;
  }

  /* ── Build a single radio option ───────────────────────── */
  function buildOption(p) {
    const usdStr = `$${p.amountUsd.toFixed(p.amountUsd < 1 ? 3 : 2)}`;
    const bdtStr = p.amountBDT ? `৳${p.amountBDT.toLocaleString('en-BD')}` : '';
    const shown  = shortPackName(p);

    const label  = document.createElement('label');
    label.className = 'ff-option-item';
    label.innerHTML = `
      <input type="radio" name="ff_package"
        value="${p.productName} — ${usdStr}${bdtStr ? ' / ' + bdtStr : ''}"
        data-product-id="${p.productId}"
        data-item4gamer-product-id="${p.item4gamerProductId}"
        data-variation-id="${p.variationId}"
        data-game-id="freefire"
        data-package-name="${p.productName}"
        data-amount-usd="${p.amountUsd}"
        data-amount-bdt="${p.amountBDT ?? ''}"
        data-provider="item4gamer"
        data-is-membership="${p.isMembership ? '1' : '0'}"
      />
      <span class="ff-option-label">${shown}</span>
      <span class="ff-option-price">
        <strong>${usdStr}</strong>
        ${bdtStr ? `<small>${bdtStr}</small>` : ''}
      </span>`;

    label.querySelector('input').addEventListener('change', function () {
      if (this.checked) {
        const usd = parseFloat(this.dataset.amountUsd || 0);
        if (typeof window.ffUpdateAmount === 'function') window.ffUpdateAmount(usd);
        else if (typeof window.setServiceAmountUsd === 'function') window.setServiceAmountUsd(usd);
        const panel = this.closest('.ff-pack-panel');
        if (panel) collapsePack(panel, true);
      }
    });
    return label;
  }

  function packToggleLabel(listEl, kind) {
    const checked = listEl.querySelector('input:checked');
    if (checked) {
      const shown = shortPackName({ productName: checked.dataset.packageName || '' });
      const usd = parseFloat(checked.dataset.amountUsd || 0);
      const usdStr = '$' + usd.toFixed(usd < 1 ? 3 : 2);
      return '<span class="pt-label">' + shown + '</span><span class="pt-right"><span class="pt-price">' + usdStr + '</span><span class="ff-pack-chev">▾</span></span>';
    }
    const title = kind === 'mem' ? 'Membership Choose' : 'Package Choose';
    return '<span class="pt-label">' + title + '<small>Tap to view</small></span><span class="pt-right"><span class="ff-pack-chev">▾</span></span>';
  }

  function collapsePack(panel, afterPick) {
    const wrap = panel.parentElement;
    const btn = wrap && wrap.querySelector('.ff-pack-toggle');
    if (!btn) return;
    panel.hidden = true;
    btn.classList.remove('open');
    if (afterPick) btn.innerHTML = packToggleLabel(panel, btn.dataset.kind || 'dia');
  }

  function ensurePackToggle(container, kind) {
    const parent = container.parentElement;
    if (!parent) return;
    let btn = parent.querySelector(':scope > .ff-pack-toggle');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ff-pack-toggle';
      parent.insertBefore(btn, container);
    }
    btn.dataset.kind = kind;
    container.classList.add('ff-pack-panel');
    container.hidden = true;
    btn.classList.remove('open');
    btn.innerHTML = packToggleLabel(container, kind);
    if (!btn.dataset.rhBound) {
      btn.dataset.rhBound = '1';
      btn.addEventListener('click', function () {
        const open = container.hidden;
        container.hidden = !open;
        btn.classList.toggle('open', open);
      });
    }
  }

  /* ── Render product list into a container ──────────────── */
  function renderList(products, container, emptyMsg, kind) {
    if (!container) return;
    container.innerHTML = '';
    if (!products.length) {
      container.innerHTML = `<div class="i4g-load-error">${emptyMsg || 'No products available.'}</div>`;
      ensurePackToggle(container, kind || 'dia');
      return;
    }
    const list = document.createElement('div');
    list.className = 'ff-option-list';
    products.forEach(p => list.appendChild(buildOption(p)));
    container.appendChild(list);
    ensurePackToggle(container, kind || 'dia');
  }

  /* ── Loading / error state helpers ─────────────────────── */
  function showLoading(el) {
    if (el) el.innerHTML = `<div class="i4g-loading-state"><span class="i4g-spinner"></span>Loading live prices…</div>`;
  }
  function showError(el) {
    if (el) el.innerHTML = `<div class="i4g-load-error">Failed to load prices. <button type="button" class="i4g-retry-btn" onclick="window._i4gRetry&&window._i4gRetry()">Retry</button></div>`;
  }

  /* ── Inject CSS once ────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('i4g-styles')) return;
    const s = document.createElement('style');
    s.id = 'i4g-styles';
    s.textContent = `
      .i4g-loading-state{display:flex;align-items:center;gap:10px;padding:14px;color:#aaaaaa;font-size:.88rem;font-weight:700}
      .i4g-spinner{width:18px;height:18px;border:2px solid rgba(255, 255, 255,.18);border-top-color:#ffffff;border-radius:50%;display:inline-block;animation:i4gSpin .7s linear infinite;flex-shrink:0}
      @keyframes i4gSpin{to{transform:rotate(360deg)}}
      .i4g-load-error{padding:12px 14px;border-radius:12px;background:rgba(255,80,80,.08);border:1px solid rgba(255,80,80,.18);color:#ffb0b0;font-size:.84rem;font-weight:700;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .i4g-retry-btn{border:1px solid rgba(255,80,80,.35);background:rgba(255,80,80,.12);color:#ffb0b0;border-radius:8px;padding:5px 12px;font-size:.78rem;font-weight:800;cursor:pointer;margin-left:auto}
      .i4g-retry-btn:hover{background:rgba(255,80,80,.22)}
      .i4g-uid-row{display:flex;gap:8px;align-items:stretch}
      .i4g-uid-row #mo_ff_uid{flex:1;min-width:0;min-height:48px}
      #i4g-check-player-btn,#i4g-ff-info-btn{min-height:48px}
      #i4g-check-player-btn{flex:0 0 auto;min-width:78px;max-width:132px;border:1px solid rgba(255,255,255,.34);background:#161616;color:#f5f5f3;border-radius:12px;padding:0 12px;font-weight:800;font-size:.82rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      html[data-theme="light"] #i4g-check-player-btn{background:#fff;color:#111;border:1px solid #111}
      #i4g-check-player-btn:hover{opacity:.9}
      #i4g-check-player-btn:disabled{opacity:.55;cursor:default}
      #i4g-check-player-btn.is-ok{max-width:160px}
      #i4g-ff-info-btn{display:none;flex:0 0 42px;width:42px;border:1px solid rgba(255,255,255,.34);background:#161616;color:#f5f5f3;border-radius:12px;font-weight:900;font-size:1.05rem;cursor:pointer;align-items:center;justify-content:center}
      html[data-theme="light"] #i4g-ff-info-btn{background:#fff;color:#111;border:1px solid #111}
      #i4g-ff-info-btn.show{display:flex}
      #i4g-player-status{font-size:.8rem;font-weight:700;display:none;padding:7px 4px 0;border-radius:0}
      #i4g-player-status.error{color:#ff8080;display:block}
      #i4g-ff-info-sheet{position:fixed;inset:0;z-index:4200;background:rgba(4,6,8,.92);display:none;align-items:flex-start;justify-content:center;padding:18px;overflow:auto}
      #i4g-ff-info-sheet.open{display:flex}
      #i4g-ff-info-box{width:min(520px,100%);margin:auto;background:#111;border:1px solid rgba(255,255,255,.16);border-radius:18px;padding:18px 18px 22px;color:#eee}
      html[data-theme="light"] #i4g-ff-info-box{background:#fff;color:#111;border:1px solid #111}
      #i4g-ff-info-box h3{margin:0 0 12px;font-size:1.05rem}
      .i4g-info-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid rgba(127,127,127,.18);font-size:.82rem}
      .i4g-info-row span{opacity:.7}
      .i4g-info-row b{text-align:right;word-break:break-word}
      #i4g-ff-info-close{margin-top:14px;width:100%;padding:11px;border-radius:12px;border:1px solid #111;background:#fff;color:#111;font-weight:800;cursor:pointer}
      .ff-option-list{display:grid!important;gap:4px!important}
      .ff-option-item{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;padding:7px 10px!important;border-radius:10px!important;min-height:0!important}
      .ff-pack-icon{display:none!important}
      .ff-option-label{font-size:.8rem!important;font-weight:700!important;line-height:1.25!important}
      .ff-option-price{font-size:.78rem!important}
      .ff-option-price small{font-size:.68rem!important}
      #ffServerSelect,#ffServerSelect.form-input{min-height:42px;font-weight:800;font-size:.86rem}
      html[data-theme="light"] #ffServerSelect{background:#fff;color:#111;border:1px solid #111}
      .ff-pack-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;border:1px solid rgba(255,255,255,.14);background:#0a0a0a;border-radius:10px;padding:10px 12px;cursor:pointer;font-family:inherit;text-align:left;color:#f5f5f3}
      .ff-pack-toggle .pt-label{font-size:.86rem;font-weight:700}
      .ff-pack-toggle .pt-label small{display:block;font-size:.68rem;color:#a9a9a6;font-weight:600;margin-top:1px}
      .ff-pack-toggle .pt-right{display:flex;align-items:center;gap:8px}
      .ff-pack-toggle .pt-price{font-weight:800}
      .ff-pack-toggle .ff-pack-chev{transition:transform .18s}
      .ff-pack-toggle.open .ff-pack-chev{transform:rotate(180deg)}
      .ff-pack-toggle.open{border-color:#fff;border-bottom-left-radius:0;border-bottom-right-radius:0}
      .ff-pack-panel{margin-top:0;border:1px solid #fff;border-top:none;border-radius:0 0 10px 10px;padding:6px;background:#0a0a0a}
      html[data-theme="light"] .ff-pack-toggle{background:#fff;color:#111;border:1px solid #111}
      html[data-theme="light"] .ff-pack-toggle .pt-label small{color:#4a4a48}
      html[data-theme="light"] .ff-pack-panel{background:#fff;border-color:#111}
    `;
    document.head.appendChild(s);
  }

  function resetCheckBtn() {
    const btn = document.getElementById('i4g-check-player-btn');
    const info = document.getElementById('i4g-ff-info-btn');
    if (btn) {
      btn.classList.remove('is-ok');
      btn.textContent = 'Check';
      btn.title = 'Check UID';
    }
    if (info) info.classList.remove('show');
    window._i4gPlayerInfo = null;
  }

  function prettyKey(key) {
    return String(key || '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/^Account /, '')
      .trim();
  }

  function prettyVal(val) {
    if (val === null || val === undefined || val === '') return '—';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'number' && val > 1000000000 && val < 2000000000000) {
      const ms = val < 1e12 ? val * 1000 : val;
      try { return new Date(ms).toLocaleString(); } catch (e) { return String(val); }
    }
    if (typeof val === 'string' && /^\d{10,13}$/.test(val)) {
      const n = Number(val);
      if (n > 1000000000) {
        const ms = n < 1e12 ? n * 1000 : n;
        try { return new Date(ms).toLocaleString(); } catch (e) {}
      }
    }
    return String(val);
  }

  function flattenInfo(obj, prefix, out) {
    if (!obj || typeof obj !== 'object') return out;
    Object.keys(obj).forEach(function (k) {
      if (k === 'raw' || k === '_raw') return;
      const v = obj[k];
      const label = prefix ? prefix + ' · ' + prettyKey(k) : prettyKey(k);
      if (v && typeof v === 'object' && !Array.isArray(v)) flattenInfo(v, label, out);
      else if (!Array.isArray(v)) out.push([label, prettyVal(v)]);
    });
    return out;
  }

  function openPlayerInfo() {
    const info = window._i4gPlayerInfo;
    if (!info) return;
    let sheet = document.getElementById('i4g-ff-info-sheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'i4g-ff-info-sheet';
      sheet.innerHTML = '<div id="i4g-ff-info-box"><h3>Player Info</h3><div id="i4g-ff-info-body"></div><button type="button" id="i4g-ff-info-close">Close</button></div>';
      document.body.appendChild(sheet);
      sheet.addEventListener('click', function (e) { if (e.target === sheet) sheet.classList.remove('open'); });
      document.getElementById('i4g-ff-info-close').addEventListener('click', function () { sheet.classList.remove('open'); });
    }
    const body = document.getElementById('i4g-ff-info-body');
    const acc = info.AccountInfo || info.accountInfo || {};
    const prof = info.AccountProfileInfo || info.accountProfileInfo || {};
    const guild = info.GuildInfo || {};
    const credit = info.CreditScoreInfo || {};
    const social = info.SocialInfo || {};
    const pet = info.PetInfo || {};
    const head = [];
    function add(label, val) {
      if (val === undefined || val === null || val === '') return;
      head.push([label, prettyVal(val)]);
    }
    add('Name', acc.AccountName);
    add('UID', window._i4gVerifiedUid);
    add('Server', acc.AccountRegion);
    add('Level', acc.AccountLevel);
    add('Likes', acc.AccountLikes);
    add('EXP', acc.AccountEXP);
    add('Season', acc.AccountSeasonId);
    add('Created', acc.AccountCreateTime);
    add('Last login', acc.AccountLastLogin);
    add('BR max rank', prof.BrMaxRank);
    add('BR points', prof.BrRankPoint);
    add('CS max rank', prof.CsMaxRank);
    add('CS points', prof.CsRankPoint);
    add('Credit score', credit.creditScore);
    add('Language', social.language);
    add('Guild', guild.GuildName);
    add('Guild level', guild.GuildLevel);
    add('Members', guild.GuildMember != null ? (guild.GuildMember + ' / ' + (guild.GuildCapacity || '')) : '');
    add('Pet level', pet.level);
    const rows = head.length ? head : flattenInfo(info, '', []);
    body.innerHTML = rows.length
      ? rows.map(function (r) {
          return '<div class="i4g-info-row"><span>' + String(r[0]).replace(/</g, '') + '</span><b>' + String(r[1]).replace(/</g, '') + '</b></div>';
        }).join('')
      : '<p>No extra details.</p>';
    sheet.classList.add('open');
  }

  function injectCheckPlayerUI() {
    injectCSS();
    const uidInput = document.getElementById('mo_ff_uid');
    if (!uidInput) return;

    let row = uidInput.closest('.i4g-uid-row');
    if (!row) {
      const parent = uidInput.closest('.form-group') || uidInput.parentElement;
      if (!parent) return;
      row = document.createElement('div');
      row.className = 'i4g-uid-row';
      uidInput.parentNode.insertBefore(row, uidInput);
      row.appendChild(uidInput);
    }

    let btn = document.getElementById('i4g-check-player-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'i4g-check-player-btn';
      btn.textContent = 'Check';
      row.appendChild(btn);
    }
    let infoBtn = document.getElementById('i4g-ff-info-btn');
    if (!infoBtn) {
      infoBtn = document.createElement('button');
      infoBtn.type = 'button';
      infoBtn.id = 'i4g-ff-info-btn';
      infoBtn.textContent = '!';
      infoBtn.setAttribute('aria-label', 'Player info');
      row.appendChild(infoBtn);
    }

    const parent = uidInput.closest('.form-group') || row.parentElement;
    let status = document.getElementById('i4g-player-status');
    if (!status && parent) {
      status = document.createElement('div');
      status.id = 'i4g-player-status';
      parent.appendChild(status);
    }

    if (!btn.dataset.rhBound) {
      btn.dataset.rhBound = '1';
      btn.addEventListener('click', runPlayerCheck);
    }
    if (!infoBtn.dataset.rhBound) {
      infoBtn.dataset.rhBound = '1';
      infoBtn.addEventListener('click', openPlayerInfo);
    }
    if (!uidInput.dataset.rhBound) {
      uidInput.dataset.rhBound = '1';
      uidInput.addEventListener('input', function () {
        if (window._i4gVerifiedUid && this.value.trim() !== window._i4gVerifiedUid) {
          window._i4gPlayerVerified = false;
          window._i4gVerifiedUid = null;
          window._i4gVerifiedName = null;
          resetCheckBtn();
          const st = document.getElementById('i4g-player-status');
          if (st) { st.className = ''; st.style.display = 'none'; st.textContent = ''; }
        }
      });
    }
  }

  async function runPlayerCheck() {
    const btn = document.getElementById('i4g-check-player-btn');
    const infoBtn = document.getElementById('i4g-ff-info-btn');
    const st = document.getElementById('i4g-player-status');
    const uid = (document.getElementById('mo_ff_uid')?.value || '').trim();

    if (!uid) {
      if (st) { st.className = 'error'; st.textContent = 'Enter your Free Fire UID.'; st.style.display = 'block'; }
      return;
    }

    btn.disabled = true;
    btn.classList.remove('is-ok');
    btn.innerHTML = '<span class="i4g-spinner" style="width:13px;height:13px;border-width:2px"></span>';
    if (infoBtn) infoBtn.classList.remove('show');
    if (st) { st.className = ''; st.style.display = 'none'; st.textContent = ''; }

    try {
      const result = await checkPlayer(uid);

      if (result.ok) {
        window._i4gPlayerVerified = true;
        window._i4gVerifiedUid = uid;
        window._i4gVerifiedName = result.playerName || '';
        window._i4gPlayerInfo = result.extra || result;
        const name = result.playerName || 'Verified';
        btn.classList.add('is-ok');
        btn.textContent = name;
        btn.title = name;
        if (infoBtn) infoBtn.classList.add('show');
        const mapped = CODE_TO_REGION[String(result.server || '').toUpperCase()];
        const sel = document.getElementById('ffServerSelect');
        if (mapped && sel && [...sel.options].some(o => o.value === mapped)) {
          selectedRegion = mapped;
          sel.value = mapped;
          renderByRegion();
        }
      } else if (result.soft) {
        window._i4gPlayerVerified = true;
        window._i4gVerifiedUid = uid;
        btn.classList.add('is-ok');
        btn.textContent = 'OK';
        btn.title = 'UID saved';
        if (st) { st.className = ''; st.style.display = 'none'; st.textContent = ''; }
      } else {
        window._i4gPlayerVerified = false;
        window._i4gVerifiedUid = null;
        window._i4gPlayerInfo = null;
        btn.textContent = 'Check';
        if (st) {
          st.className = 'error';
          st.textContent = result.error || 'Invalid UID.';
          st.style.display = 'block';
        }
      }
    } catch (err) {
      window._i4gPlayerVerified = true;
      window._i4gVerifiedUid = uid;
      btn.textContent = 'Check';
      if (st) {
        st.className = 'error';
        st.textContent = 'Check unavailable. You can still continue.';
        st.style.display = 'block';
      }
    }

    btn.disabled = false;
  }

  /* ── enrichI4GOrderData — called by service-modal ──────── */
  function enrichI4GOrderData(data, form) {
    if (!form) return data;
    const pkg   = form.querySelector('input[name="ff_package"]:checked');
    const ffUid = (document.getElementById('mo_ff_uid')?.value || '').trim();

    if (pkg) {
      const productId   = pkg.dataset.productId   || pkg.getAttribute('data-product-id')   || '';
      const variationId = pkg.dataset.variationId  || pkg.getAttribute('data-variation-id') || productId;
      const i4gId       = pkg.dataset.item4gamerProductId || pkg.getAttribute('data-item4gamer-product-id') || variationId;
      const isMem       = pkg.dataset.isMembership === '1';
      const amountUsd   = parseFloat(pkg.dataset.amountUsd || 0) || null;
      const amountBDT   = parseFloat(pkg.dataset.amountBdt || 0) || null;
      const name        = pkg.dataset.packageName || '';

      data.provider            = 'item4gamer';
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
      data.isMembership        = isMem;
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

  /* ── Main load ──────────────────────────────────────────── */
  async function loadAndRender() {
    injectCSS();

    const diamondEl    = document.getElementById('ffDiamondOptionsList');
    const membershipEl = document.getElementById('ffMembershipOptionsList');
    if (!diamondEl && !membershipEl) return;

    if (diamondEl)    showLoading(diamondEl);
    if (membershipEl) showLoading(membershipEl);

    window._i4gRetry = loadAndRender;

    // Auto-retry (handles Render cold start / empty cache)
    let products = [];
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 3000;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        products = await fetchProducts();
      } catch (err) {
        console.error(`[Item4Gamer] Load attempt ${attempt} failed:`, err.message);
        if (attempt === MAX_ATTEMPTS) {
          if (diamondEl)    showError(diamondEl);
          if (membershipEl) showError(membershipEl);
          return;
        }
        if (diamondEl)    showLoading(diamondEl);
        if (membershipEl) showLoading(membershipEl);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }

      if (products.length > 0) break;

      console.warn(`[Item4Gamer] Empty product list on attempt ${attempt}`);
      if (attempt === MAX_ATTEMPTS) {
        if (diamondEl)    showError(diamondEl);
        if (membershipEl) showError(membershipEl);
        return;
      }
      if (diamondEl)    showLoading(diamondEl);
      if (membershipEl) showLoading(membershipEl);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    }

    window._i4gProducts = products;
    console.log(`[Item4Gamer] Loaded ${products.length} products from cache`);

    ensureServerSelect(products);
    renderByRegion();
    setTimeout(injectCheckPlayerUI, 80);
  }

  function uniqueRegions(products) {
    const set = {};
    (products || []).forEach(p => {
      const r = regionOf(p);
      if (r) set[r] = true;
    });
    const extra = Object.keys(set).filter(r => REGION_ORDER.indexOf(r) === -1).sort();
    return REGION_ORDER.filter(r => set[r]).concat(extra);
  }

  function ensureServerSelect(products) {
    const regions = uniqueRegions(products);
    if (regions.indexOf('Bangladesh') !== -1) selectedRegion = 'Bangladesh';
    else if (regions.length) selectedRegion = regions[0];

    let host = document.getElementById('ffServerSelect');
    if (!host) {
      const diamondEl = document.getElementById('ffDiamondOptionsList');
      const parent = diamondEl && (diamondEl.closest('.form-group') || diamondEl.parentElement);
      if (!parent || !parent.parentNode) return;
      const wrap = document.createElement('div');
      wrap.className = 'form-group';
      wrap.id = 'ffServerGroup';
      wrap.innerHTML = '<label class="form-label">Server</label><select class="form-input" id="ffServerSelect"></select>';
      parent.parentNode.insertBefore(wrap, parent);
      host = wrap.querySelector('#ffServerSelect');
    }
    if (host.tagName !== 'SELECT') {
      const sel = document.createElement('select');
      sel.id = 'ffServerSelect';
      sel.className = 'form-input';
      host.replaceWith(sel);
      host = sel;
    }
    host.innerHTML = regions.map(r => {
      const label = r === 'Bangladesh' ? 'Bangladesh (BD)' : r;
      return `<option value="${r}"${r === selectedRegion ? ' selected' : ''}>${label}</option>`;
    }).join('');
    if (!host.dataset.rhBound) {
      host.dataset.rhBound = '1';
      host.addEventListener('change', function () {
        selectedRegion = this.value || 'Bangladesh';
        renderByRegion();
      });
    } else {
      host.value = selectedRegion;
    }
  }

  function renderByRegion() {
    const products = window._i4gProducts || [];
    const diamondEl    = document.getElementById('ffDiamondOptionsList');
    const membershipEl = document.getElementById('ffMembershipOptionsList');
    const region = selectedRegion || 'Bangladesh';
    const filtered = products.filter(p => regionOf(p) === region);
    const diamonds    = filtered.filter(p => !p.isMembership);
    const memberships = filtered.filter(p => p.isMembership);
    renderList(diamonds,    diamondEl,    'এই সার্ভারে ডায়মন্ড প্যাকেজ নেই।', 'dia');
    renderList(memberships, membershipEl, 'এই সার্ভারে উইকলি/মান্থলি নেই।', 'mem');
  }

  /* ── Public API ─────────────────────────────────────────── */
  window.Item4Gamer = {
    fetchProducts, checkPlayer, loadAndRender,
    enrichI4GOrderData, injectCheckPlayerUI,
    getProducts: () => window._i4gProducts || []
  };

  /* ── Patch openServiceModal to trigger load on FF open ─── */
  function init() {
    injectCSS();
    injectCheckPlayerUI();
    if (document.body) {
      new MutationObserver(function () { injectCheckPlayerUI(); }).observe(document.body, { childList: true, subtree: true });
    }

    const ffFields = document.getElementById('ffFields');
    if (!ffFields) return;

    let loaded = false;

    const tryLoad = () => {
      if (loaded) return;
      if (ffFields.style.display !== 'none' && ffFields.offsetParent !== null) {
        loaded = true;
        loadAndRender();
      }
    };

    new MutationObserver(tryLoad).observe(ffFields, { attributes: true, attributeFilter: ['style', 'class'] });
    tryLoad();

    const origOpen = window.openServiceModal;
    window.openServiceModal = function (name, type) {
      if (typeof origOpen === 'function') origOpen(name, type);
      if (type === 'ff') {
        if (!loaded) {
          loaded = true;
          setTimeout(loadAndRender, 60);
        } else {
          setTimeout(injectCheckPlayerUI, 80);
        }
        // Reset verify state when modal opens fresh
        window._i4gPlayerVerified = false;
        window._i4gVerifiedUid    = null;
        window._i4gVerifiedName   = null;
        window._i4gPlayerInfo     = null;
      }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
