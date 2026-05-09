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
    const isMembership = MEMBERSHIP_IDS.has(productId) ||
                         String(p.type || '').toLowerCase() === 'membership';
    const name         = String(p.productName ?? p.product_name ?? p.name ?? p.title ?? 'Unknown Package').trim();
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

  /* ── Fetch products from backend cache (instant) ───────── */
  async function fetchProducts() {
    const url = `${BACKEND_BASE}/api/item4gamer/products?category_id=${FF_CATEGORY_ID}`;
    let res;
    try {
      res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      throw new Error('Network error loading products. Please try again.');
    }
    if (!res.ok) throw new Error(`Backend HTTP ${res.status} fetching products.`);

    let raw;
    try { raw = await res.json(); } catch (e) { throw new Error('Invalid JSON from backend.'); }

    const list = unwrapProducts(raw);
    return list
      .map(p => normalizeProduct(p))
      .filter(p => {
        if (!p.hasPrice) return false;
        return true;
      });
  }

  /* ── Check player via backend ──────────────────────────── */
  async function checkPlayer(uid) {
    if (!String(uid).trim()) return { ok: false, error: 'UID is empty.' };

    // Try GET first, fall back to POST on 405
    let res;
    const uidEnc = encodeURIComponent(String(uid).trim());
    try {
      res = await fetch(`${BACKEND_BASE}/api/item4gamer/check-player?uid=${uidEnc}&game=freefire`);
    } catch (e) {
      return { ok: false, error: 'Network error. You can still continue manually.', soft: true };
    }

    if (res.status === 405) {
      try {
        res = await fetch(`${BACKEND_BASE}/api/item4gamer/check-player`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: String(uid).trim(), game: 'freefire' })
        });
      } catch (e) {
        return { ok: false, error: 'Network error. You can still continue manually.', soft: true };
      }
    }

    let data;
    try { data = await res.json(); } catch (e) {
      return { ok: false, error: 'Could not verify player. You can still continue manually.', soft: true };
    }

    if (!res.ok || data.ok === false || data.success === false) {
      const msg = data.message || data.error || data.msg || 'Player not found. Check your UID.';
      // soft = API issue (not wrong UID), hard = wrong UID
      const soft = res.status >= 500 || !!data.providerError;
      return { ok: false, error: msg, soft };
    }

    const info = data.data || data.player || data.result || data;
    return {
      ok:         true,
      playerName: info.playerName || info.name || info.username || info.nickname || '',
      server:     info.server || info.region || info.zone || '',
      extra:      info
    };
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
    const icon   = p.isMembership ? membershipSVG() : diamondSVG();

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
      <span class="ff-option-label">
        <span class="ff-pack-icon${p.isMembership ? ' ff-card-pro' : ''}" aria-hidden="true">${icon}</span>
        ${p.productName}
      </span>
      <span class="ff-option-price">
        <strong>${usdStr}</strong>
        ${bdtStr ? `<small>${bdtStr}</small>` : ''}
      </span>`;

    label.querySelector('input').addEventListener('change', function () {
      if (this.checked) {
        const usd = parseFloat(this.dataset.amountUsd || 0);
        if (typeof window.ffUpdateAmount === 'function') window.ffUpdateAmount(usd);
        else if (typeof window.setServiceAmountUsd === 'function') window.setServiceAmountUsd(usd);
      }
    });
    return label;
  }

  /* ── Render product list into a container ──────────────── */
  function renderList(products, container, emptyMsg) {
    if (!container) return;
    container.innerHTML = '';
    if (!products.length) {
      container.innerHTML = `<div class="i4g-load-error">${emptyMsg || 'No products available.'}</div>`;
      return;
    }
    const list = document.createElement('div');
    list.className = 'ff-option-list';
    products.forEach(p => list.appendChild(buildOption(p)));
    container.appendChild(list);
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
      .i4g-loading-state{display:flex;align-items:center;gap:10px;padding:14px;color:#7a8ca8;font-size:.88rem;font-weight:700}
      .i4g-spinner{width:18px;height:18px;border:2px solid rgba(0,200,255,.18);border-top-color:#00c8ff;border-radius:50%;display:inline-block;animation:i4gSpin .7s linear infinite;flex-shrink:0}
      @keyframes i4gSpin{to{transform:rotate(360deg)}}
      .i4g-load-error{padding:12px 14px;border-radius:12px;background:rgba(255,80,80,.08);border:1px solid rgba(255,80,80,.18);color:#ffb0b0;font-size:.84rem;font-weight:700;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .i4g-retry-btn{border:1px solid rgba(255,80,80,.35);background:rgba(255,80,80,.12);color:#ffb0b0;border-radius:8px;padding:5px 12px;font-size:.78rem;font-weight:800;cursor:pointer;margin-left:auto}
      .i4g-retry-btn:hover{background:rgba(255,80,80,.22)}
      /* Check Player button */
      #i4g-check-player-btn{border:1px solid rgba(0,200,255,.35);background:rgba(0,200,255,.10);color:#9ee8ff;border-radius:10px;padding:8px 16px;font-weight:800;font-size:.82rem;cursor:pointer;display:flex;align-items:center;gap:7px;transition:.2s;white-space:nowrap}
      #i4g-check-player-btn:hover{background:rgba(0,200,255,.22)!important;border-color:rgba(0,200,255,.60)!important}
      #i4g-check-player-btn:disabled{opacity:.55;cursor:default!important}
      #i4g-player-status{font-size:.82rem;font-weight:700;display:none;padding:7px 12px;border-radius:10px;flex:1;min-width:0}
      #i4g-player-status.success{background:rgba(0,255,136,.10);border:1px solid rgba(0,255,136,.25);color:#a7ffcf}
      #i4g-player-status.error{background:rgba(255,80,80,.10);border:1px solid rgba(255,80,80,.22);color:#ffb0b0}
      #i4g-player-status.info{background:rgba(0,200,255,.08);border:1px solid rgba(0,200,255,.18);color:#9ee8ff}
      #i4g-check-player-row{display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap}
      /* Verify badge on UID input */
      .i4g-uid-verified::after{content:'✓ Verified';font-size:.72rem;color:#a7ffcf;font-weight:800;margin-left:8px}
    `;
    document.head.appendChild(s);
  }

  /* ── Inject "Check Player" button below UID input ───────── */
  function injectCheckPlayerUI() {
    const uidInput = document.getElementById('mo_ff_uid');
    if (!uidInput || document.getElementById('i4g-check-player-btn')) return;

    const parent = uidInput.closest('.form-group') || uidInput.parentElement;
    if (!parent) return;

    const row = document.createElement('div');
    row.id = 'i4g-check-player-row';
    row.innerHTML = `
      <button type="button" id="i4g-check-player-btn" aria-label="Check Free Fire Player ID">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        Check Player ID
      </button>
      <div id="i4g-player-status"></div>`;
    parent.appendChild(row);

    document.getElementById('i4g-check-player-btn').addEventListener('click', runPlayerCheck);

    // Re-verify if UID changes after a successful verify
    uidInput.addEventListener('input', function () {
      if (window._i4gVerifiedUid && this.value.trim() !== window._i4gVerifiedUid) {
        window._i4gPlayerVerified = false;
        window._i4gVerifiedUid    = null;
        window._i4gVerifiedName   = null;
        const st = document.getElementById('i4g-player-status');
        if (st) { st.className = ''; st.style.display = 'none'; st.textContent = ''; }
      }
    });
  }

  async function runPlayerCheck() {
    const btn    = document.getElementById('i4g-check-player-btn');
    const st     = document.getElementById('i4g-player-status');
    const uid    = (document.getElementById('mo_ff_uid')?.value || '').trim();

    if (!uid) {
      if (st) { st.className = 'error'; st.textContent = 'আপনার Free Fire UID লিখুন।'; st.style.display = 'block'; }
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="i4g-spinner" style="width:13px;height:13px;border-width:2px"></span> Checking…`;
    if (st) { st.className = 'info'; st.textContent = 'Verifying player…'; st.style.display = 'block'; }

    try {
      const result = await checkPlayer(uid);

      if (result.ok) {
        window._i4gPlayerVerified = true;
        window._i4gVerifiedUid    = uid;
        window._i4gVerifiedName   = result.playerName || '';

        const parts = [];
        if (result.playerName) parts.push(`✓ ${result.playerName}`);
        else parts.push('✓ Player verified');
        if (result.server) parts.push(`Server: ${result.server}`);

        if (st) { st.className = 'success'; st.textContent = parts.join(' · '); st.style.display = 'block'; }

      } else if (result.soft) {
        // API issue — allow to continue but note it
        window._i4gPlayerVerified = true; // soft-pass
        window._i4gVerifiedUid    = uid;
        if (st) {
          st.className   = 'info';
          st.textContent = result.error || 'Player check unavailable. You can still continue manually.';
          st.style.display = 'block';
        }
      } else {
        // Hard fail — wrong UID
        window._i4gPlayerVerified = false;
        window._i4gVerifiedUid    = null;
        if (st) { st.className = 'error'; st.textContent = result.error || 'Invalid UID. Please check and try again.'; st.style.display = 'block'; }
      }
    } catch (err) {
      // Network error — soft-pass
      window._i4gPlayerVerified = true;
      window._i4gVerifiedUid    = uid;
      if (st) { st.className = 'info'; st.textContent = 'Player check unavailable. You can still continue manually.'; st.style.display = 'block'; }
    }

    btn.disabled = false;
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> Check Player ID`;
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

    // Auto-retry up to 4 times (handles Render cold start / empty cache)
    let products = [];
    const MAX_ATTEMPTS = 4;
    const RETRY_DELAY_MS = 4000;

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

    const diamonds    = products.filter(p => !p.isMembership);
    const memberships = products.filter(p => p.isMembership);

    renderList(diamonds,    diamondEl,    'No diamond packages available.');
    renderList(memberships, membershipEl, 'No membership plans available.');

    setTimeout(injectCheckPlayerUI, 80);
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
      }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
