/* ============================================================
   Item4Gamer Integration — v2.0
   - Loads diamond products + Weekly/Monthly Membership from backend
   - Membership products: Weekly (155344), Monthly (155345)
   - All calls go to backend only — NO direct Item4Gamer API key exposed
   - Order payload includes: provider, item4gamerProductId, productId,
     variationId, productName, freeFireUid, uid, autoTopupReady,
     amountUsd, amountBDT
   ============================================================ */

(function () {
  'use strict';

  const BACKEND_BASE          = 'https://rabbi-backend-vlr7.onrender.com';
  const ITEM4GAMER_CATEGORY_ID = 19;
  const BDT_RATE              = 125; // fallback if backend doesn't return amountBDT

  // Known membership variation IDs — used for type detection
  const MEMBERSHIP_IDS = new Set(['155344', '155345']);

  /* ── Utility: safe deep-get ────────────────────────────────── */
  function safeGet(obj, ...keys) {
    return keys.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), obj);
  }

  /* ── Normalize product list from any response shape ─────────── */
  function normalizeProductList(raw) {
    if (!raw) return [];
    const candidates = [
      safeGet(raw, 'data', 'data', 'products'),
      safeGet(raw, 'data', 'products'),
      safeGet(raw, 'data', 'data'),
      safeGet(raw, 'data'),
      safeGet(raw, 'products'),
      raw
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length > 0) return candidate;
    }
    return [];
  }

  /* ── Normalize price from any product field ──────────────────── */
  function normalizePrice(product) {
    if (!product) return null;
    const raw =
      product.amountUsd    ??
      product.amountUSD    ??
      product.providerPriceUsd ??
      product.price        ??
      product.usdPrice     ??
      product.amount       ??
      null;
    if (raw === null || raw === undefined) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 10000) / 10000 : null;
  }

  /* ── Normalize BDT from any product field ────────────────────── */
  function normalizeBDT(product, usd) {
    if (!product) return null;
    const raw = product.amountBDT ?? product.amountBdt ?? null;
    if (raw !== null && raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
    // Fall back to local conversion
    if (usd !== null && usd > 0) return Math.round(usd * BDT_RATE);
    return null;
  }

  /* ── Normalize product ID ────────────────────────────────────── */
  function normalizeProductId(product) {
    if (!product) return '';
    return String(
      product.variationId  ??
      product.variation_id ??
      product.productId    ??
      product.product_id   ??
      product.id           ??
      product.itemId       ??
      ''
    );
  }

  /* ── Normalize product name ──────────────────────────────────── */
  function normalizeProductName(product) {
    if (!product) return 'Unknown Package';
    return String(
      product.productName  ??
      product.product_name ??
      product.name         ??
      product.title        ??
      'Unknown Package'
    );
  }

  /* ── Detect product type ─────────────────────────────────────── */
  function detectProductType(product) {
    const id = normalizeProductId(product);
    if (MEMBERSHIP_IDS.has(id)) return 'membership';
    if (product.type) return String(product.type).toLowerCase();
    const name = normalizeProductName(product).toLowerCase();
    if (name.includes('membership') || name.includes('weekly') || name.includes('monthly')) return 'membership';
    return 'diamonds';
  }

  /* ── Fetch products from backend ─────────────────────────────── */
  async function fetchItem4GamerProducts() {
    const url = `${BACKEND_BASE}/api/item4gamer/products?category_id=${ITEM4GAMER_CATEGORY_ID}`;
    let res;
    try {
      res = await fetch(url, {
        method:  'GET',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (networkErr) {
      throw new Error('Network error loading products. Please try again.');
    }
    if (!res.ok) {
      throw new Error(`Backend returned HTTP ${res.status} fetching products.`);
    }
    let raw;
    try {
      raw = await res.json();
    } catch (e) {
      throw new Error('Invalid JSON from backend while fetching products.');
    }

    const rawList = normalizeProductList(raw);

    // Map into normalized shape
    const products = rawList.map((p) => {
      const productId    = normalizeProductId(p);
      const amountUsd    = normalizePrice(p);
      const amountBDT    = normalizeBDT(p, amountUsd);
      const type         = detectProductType(p);
      const isMembership = type === 'membership';

      return {
        item4gamerProductId: productId,
        productId,
        variationId:    productId,
        productName:    normalizeProductName(p),
        amountUsd,
        amountBDT,
        provider:       'item4gamer',
        autoTopupReady: !!productId,
        type,
        isMembership,
        membershipType: p.membershipType || null,
        region:         p.region || null,
        diamonds:       p.diamonds || null,
        priceAvailable: amountUsd !== null && amountUsd > 0,
        _raw: p
      };
    });

    return products;
  }

  /* ── Check player via backend ────────────────────────────────── */
  async function checkFreefirePlayer(uid) {
    if (!uid || !String(uid).trim()) {
      return { ok: false, error: 'UID is empty.' };
    }

    // Try GET first (backend supports both)
    const urlGet = `${BACKEND_BASE}/api/item4gamer/check-player?uid=${encodeURIComponent(String(uid).trim())}&game=freefire`;
    let res;
    try {
      res = await fetch(urlGet, {
        method:  'GET',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (networkErr) {
      return { ok: false, error: 'Network error checking player. Please try again.' };
    }

    // If GET fails with 405, fall back to POST
    if (res.status === 405) {
      try {
        res = await fetch(`${BACKEND_BASE}/api/item4gamer/check-player`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ uid: String(uid).trim(), game: 'freefire' })
        });
      } catch (networkErr) {
        return { ok: false, error: 'Network error checking player. Please try again.' };
      }
    }

    let data;
    try {
      data = await res.json();
    } catch (e) {
      return {
        ok:            false,
        error:         'Could not verify player at this time. You may still place the order manually.',
        providerError: true
      };
    }

    if (!res.ok || data.ok === false || data.success === false) {
      const msg =
        data.message ||
        data.error   ||
        data.msg     ||
        'Player check unavailable. You can still continue manually.';
      return { ok: false, error: msg, providerError: true };
    }

    const playerInfo = data.data || data.player || data.result || data;
    return {
      ok:         true,
      playerName: playerInfo.playerName || playerInfo.name || playerInfo.username || playerInfo.nickname || '',
      server:     playerInfo.server     || playerInfo.region || playerInfo.zone || '',
      extra:      playerInfo
    };
  }

  /* ── Build Diamond SVG icon ──────────────────────────────────── */
  function diamondSVG(color) {
    const c = color || 'currentColor';
    return `<svg viewBox="0 0 24 24" fill="none" style="width:18px;height:18px;display:block;">
      <path d="M6 4h12l4 6-10 10L2 10l4-6Z" fill="${c}" opacity=".22"/>
      <path d="M2 10h20M6 4l3 6 3-6 3 6 3-6M9 10l3 10 3-10" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`;
  }

  /* ── Build Membership/Calendar SVG icon ──────────────────────── */
  function membershipSVG(color) {
    const c = color || 'currentColor';
    return `<svg viewBox="0 0 24 24" fill="none" style="width:18px;height:18px;display:block;">
      <rect x="3" y="5" width="18" height="14" rx="3" fill="${c}" opacity=".16" stroke="${c}" stroke-width="1.7"/>
      <path d="M3 10h18M7 15h4" stroke="${c}" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M17 14l1 2 2 .3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1L14 16.3l2-.3 1-2Z" fill="${c}"/>
    </svg>`;
  }

  /* ── Render a single option item ─────────────────────────────── */
  function buildOptionItem(product) {
    const usdStr  = product.priceAvailable
      ? `$${product.amountUsd.toFixed(product.amountUsd < 1 ? 3 : 2)}`
      : 'Price N/A';
    const bdtStr  = product.amountBDT
      ? `৳${product.amountBDT.toLocaleString('en-BD')}`
      : '';
    const name    = product.productName;
    const isMem   = product.isMembership;
    const iconHtml = isMem
      ? membershipSVG(isMem ? '#79d7ff' : '#66e6ff')
      : diamondSVG('#66e6ff');

    const disabled = !product.priceAvailable ? 'disabled' : '';

    const label = document.createElement('label');
    label.className = `ff-option-item${!product.priceAvailable ? ' ff-option-unavailable' : ''}`;
    label.innerHTML = `
      <input
        type="radio"
        name="ff_package"
        value="${name} — ${usdStr}${bdtStr ? ' / ' + bdtStr : ''}"
        data-product-id="${product.productId}"
        data-item4gamer-product-id="${product.item4gamerProductId}"
        data-variation-id="${product.variationId}"
        data-game-id="freefire"
        data-package-name="${name}"
        data-amount-usd="${product.amountUsd ?? ''}"
        data-amount-bdt="${product.amountBDT ?? ''}"
        data-provider="item4gamer"
        data-is-membership="${isMem ? '1' : '0'}"
        ${disabled}
      />
      <span class="ff-option-label">
        <span class="ff-pack-icon${isMem ? ' ff-card-pro' : ''}" aria-hidden="true">${iconHtml}</span>
        ${name}
        ${!product.priceAvailable ? '<small style="color:#ff8a8a;font-size:.72rem;margin-left:6px;">(price unavailable)</small>' : ''}
      </span>
      <span class="ff-option-price">
        <strong>${usdStr}</strong>
        ${bdtStr ? `<small>${bdtStr}</small>` : ''}
      </span>
    `;

    const radio = label.querySelector('input[type=radio]');
    if (radio && product.priceAvailable) {
      radio.addEventListener('change', function () {
        if (this.checked) {
          const usd = parseFloat(this.dataset.amountUsd || 0);
          if (typeof window.ffUpdateAmount === 'function') {
            window.ffUpdateAmount(usd);
          } else if (typeof window.setServiceAmountUsd === 'function') {
            window.setServiceAmountUsd(usd);
          }
        }
      });
    }

    return label;
  }

  /* ── Render diamond products into container ──────────────────── */
  function renderDiamondProducts(products, container) {
    if (!container) return;
    container.innerHTML = '';

    const diamonds = products.filter(p => !p.isMembership);

    if (!diamonds || diamonds.length === 0) {
      container.innerHTML = `<div class="i4g-load-error">No diamond packages available right now.</div>`;
      return;
    }

    const list = document.createElement('div');
    list.className = 'ff-option-list';
    diamonds.forEach(p => list.appendChild(buildOptionItem(p)));
    container.appendChild(list);
  }

  /* ── Render membership products into container ───────────────── */
  function renderMembershipProducts(products, container) {
    if (!container) return;
    container.innerHTML = '';

    // Only Weekly (155344) and Monthly (155345) — no Weekly Lite unless it appears in live data
    const memberships = products.filter(p => p.isMembership);

    if (!memberships || memberships.length === 0) {
      container.innerHTML = `<div class="i4g-load-error">No membership plans available right now.</div>`;
      return;
    }

    const list = document.createElement('div');
    list.className = 'ff-option-list';
    memberships.forEach(p => list.appendChild(buildOptionItem(p)));
    container.appendChild(list);
  }

  /* ── Loading / Error state helpers ──────────────────────────── */
  function showProductsLoading(container) {
    if (!container) return;
    container.innerHTML = `<div class="i4g-loading-state">
      <span class="i4g-spinner" aria-hidden="true"></span>
      Loading prices…
    </div>`;
  }

  function showProductsError(container) {
    if (!container) return;
    container.innerHTML = `<div class="i4g-load-error">
      Failed to load live prices. Please try again.
      <button type="button" class="i4g-retry-btn" onclick="window._i4gRetryLoad && window._i4gRetryLoad()">Retry</button>
    </div>`;
  }

  /* ── Inject Check Player UI near UID input ───────────────────── */
  function injectCheckPlayerUI() {
    const uidInput = document.getElementById('mo_ff_uid');
    if (!uidInput) return;
    if (document.getElementById('i4g-check-player-btn')) return;

    const formGroup = uidInput.closest('.form-group') || uidInput.parentElement;
    if (!formGroup) return;

    const checkRow = document.createElement('div');
    checkRow.id = 'i4g-check-player-row';
    checkRow.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;';
    checkRow.innerHTML = `
      <button type="button" id="i4g-check-player-btn"
        style="border:1px solid rgba(0,200,255,.35);background:rgba(0,200,255,.10);color:#9ee8ff;
        border-radius:10px;padding:8px 16px;font-weight:800;font-size:.82rem;cursor:pointer;
        display:flex;align-items:center;gap:7px;transition:.2s;white-space:nowrap;"
        aria-label="Check Free Fire Player">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        Check Player
      </button>
      <div id="i4g-player-status" style="font-size:.82rem;font-weight:700;display:none;padding:7px 12px;border-radius:10px;flex:1;min-width:0;"></div>
    `;
    formGroup.appendChild(checkRow);

    if (!document.getElementById('i4g-check-player-style')) {
      const style = document.createElement('style');
      style.id = 'i4g-check-player-style';
      style.textContent = `
        #i4g-check-player-btn:hover { background:rgba(0,200,255,.22)!important; border-color:rgba(0,200,255,.60)!important; }
        #i4g-check-player-btn:disabled { opacity:.6; cursor:default!important; }
        #i4g-player-status.success { background:rgba(0,255,136,.10); border:1px solid rgba(0,255,136,.25); color:#a7ffcf; }
        #i4g-player-status.error   { background:rgba(255,80,80,.10);  border:1px solid rgba(255,80,80,.22);  color:#ffb0b0; }
        #i4g-player-status.checking{ background:rgba(0,200,255,.08);  border:1px solid rgba(0,200,255,.18);  color:#9ee8ff; }
        .i4g-loading-state { display:flex; align-items:center; gap:10px; padding:14px; color:#7a8ca8; font-size:.88rem; font-weight:700; }
        .i4g-spinner { width:18px; height:18px; border:2px solid rgba(0,200,255,.18); border-top-color:#00c8ff; border-radius:50%; display:inline-block; animation:i4gSpin .7s linear infinite; flex-shrink:0; }
        @keyframes i4gSpin { to { transform:rotate(360deg); } }
        .i4g-load-error { padding:12px 14px; border-radius:12px; background:rgba(255,80,80,.08); border:1px solid rgba(255,80,80,.18); color:#ffb0b0; font-size:.84rem; font-weight:700; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .i4g-retry-btn { border:1px solid rgba(255,80,80,.35); background:rgba(255,80,80,.12); color:#ffb0b0; border-radius:8px; padding:5px 12px; font-size:.78rem; font-weight:800; cursor:pointer; margin-left:auto; }
        .i4g-retry-btn:hover { background:rgba(255,80,80,.22); }
        .ff-option-unavailable { opacity:.55; cursor:not-allowed; }
        .ff-option-unavailable input[type=radio] { pointer-events:none; }
      `;
      document.head.appendChild(style);
    }

    const btn = document.getElementById('i4g-check-player-btn');
    if (btn) {
      btn.addEventListener('click', async function () {
        const uid      = (document.getElementById('mo_ff_uid')?.value || '').trim();
        const statusEl = document.getElementById('i4g-player-status');

        if (!uid) {
          if (statusEl) {
            statusEl.className   = 'error';
            statusEl.textContent = 'Please enter your Free Fire UID first.';
            statusEl.style.display = 'block';
          }
          return;
        }

        btn.disabled = true;
        btn.innerHTML = `<span class="i4g-spinner" style="width:13px;height:13px;border-width:2px;"></span> Checking…`;
        if (statusEl) {
          statusEl.className   = 'checking';
          statusEl.textContent = 'Checking player…';
          statusEl.style.display = 'block';
        }

        try {
          const result = await checkFreefirePlayer(uid);
          if (result.ok) {
            const parts = [];
            if (result.playerName) parts.push(`✓ ${result.playerName}`);
            if (result.server)     parts.push(`Server: ${result.server}`);
            if (!parts.length)     parts.push('✓ Player verified');
            if (statusEl) {
              statusEl.className   = 'success';
              statusEl.textContent = parts.join(' · ');
              statusEl.style.display = 'block';
            }
            window._i4gVerifiedUid = uid;
          } else {
            if (statusEl) {
              statusEl.className   = result.providerError ? 'checking' : 'error';
              statusEl.textContent = result.error || 'Player check failed.';
              statusEl.style.display = 'block';
            }
            // providerError = API issue, not wrong UID — still allow order
            window._i4gVerifiedUid = result.providerError ? uid : null;
          }
        } catch (err) {
          if (statusEl) {
            statusEl.className   = 'checking';
            statusEl.textContent = 'Player check unavailable. You can still continue manually.';
            statusEl.style.display = 'block';
          }
          window._i4gVerifiedUid = uid;
        } finally {
          btn.disabled = false;
          btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg> Check Player`;
        }
      });
    }
  }

  /* ── Main: load products, hydrate diamond + membership sections ─ */
  async function loadAndRenderProducts() {
    // Diamond container (injected dynamically by item4gamer.js itself)
    const diamondContainer    = document.getElementById('ffDiamondOptionsList');
    // Membership container (injected dynamically)
    const membershipContainer = document.getElementById('ffMembershipOptionsList');

    // If neither container exists, nothing to do
    if (!diamondContainer && !membershipContainer) return;

    if (diamondContainer)    showProductsLoading(diamondContainer);
    if (membershipContainer) showProductsLoading(membershipContainer);

    window._i4gRetryLoad = loadAndRenderProducts;

    let products;
    try {
      products = await fetchItem4GamerProducts();
    } catch (err) {
      if (diamondContainer)    showProductsError(diamondContainer);
      if (membershipContainer) showProductsError(membershipContainer);
      return;
    }

    if (!products || products.length === 0) {
      if (diamondContainer)    showProductsError(diamondContainer);
      if (membershipContainer) showProductsError(membershipContainer);
      return;
    }

    window._i4gProducts = products;

    if (diamondContainer)    renderDiamondProducts(products, diamondContainer);
    if (membershipContainer) renderMembershipProducts(products, membershipContainer);

    setTimeout(injectCheckPlayerUI, 100);
  }

  /* ── Enrich order data for FF auto top-up (called by service-modal) ── */
  // This overrides / supplements enrichFreeFireAutoTopupDetails in service-modal.js
  // so that item4gamer-specific fields (variationId, item4gamerProductId) are set.
  function enrichI4GOrderData(data, form) {
    if (!form) return data;

    const selectedPackage = form.querySelector('input[name="ff_package"]:checked');
    const ffUid = (document.getElementById('mo_ff_uid')?.value || '').trim();

    if (selectedPackage) {
      const productId   = selectedPackage.dataset.productId || selectedPackage.getAttribute('data-product-id') || '';
      const variationId = selectedPackage.dataset.variationId || selectedPackage.getAttribute('data-variation-id') || productId;
      const isMembership = selectedPackage.dataset.isMembership === '1';
      const amountUsd  = parseFloat(selectedPackage.dataset.amountUsd || 0) || null;
      const amountBDT  = parseFloat(selectedPackage.dataset.amountBdt || 0) || null;
      const name       = selectedPackage.dataset.packageName || '';

      data.provider            = 'item4gamer';
      data.productId           = productId;
      data.product_id          = productId;
      data.variationId         = variationId;
      data.variation_id        = variationId;
      data.item4gamerProductId = variationId || productId;
      data.fazercardsProductId = variationId || productId;
      data.gameId              = 'freefire';
      data.game_id             = 'freefire';
      data.packageName         = name;
      data.productName         = name;
      data.isMembership        = isMembership;
      data.autoTopupReady      = !!productId;

      if (amountUsd !== null && amountUsd > 0) {
        data.amountUsd = amountUsd;
        data.amountUSD = amountUsd;
      }
      if (amountBDT !== null && amountBDT > 0) {
        data.amountBDT = amountBDT;
        data.amountBdt = amountBDT;
      }
    }

    if (ffUid) {
      data.freeFireUid = ffUid;
      data.uid         = ffUid;
      data.playerId    = ffUid;
      data.player_id   = ffUid;
      data.user_id     = ffUid;
    }

    return data;
  }

  /* ── Public API ──────────────────────────────────────────────── */
  window.Item4Gamer = {
    fetchProducts:        fetchItem4GamerProducts,
    checkPlayer:          checkFreefirePlayer,
    normalizeProductList,
    normalizePrice,
    getProducts:          () => window._i4gProducts || [],
    injectCheckPlayerUI,
    loadAndRenderProducts,
    enrichI4GOrderData,
    renderDiamondProducts,
    renderMembershipProducts
  };

  /* ── Patch service-modal enrichFreeFireAutoTopupDetails ──────── */
  // Wait for service-modal to load, then override its FF enrichment
  // so that item4gamer fields (variationId, item4gamerProductId) are included.
  function patchServiceModal() {
    const form = document.getElementById('serviceOrderForm');
    if (!form) return;

    // Override enrichFreeFireAutoTopupDetails in the service-modal scope
    // by patching collectFormData indirectly via a global hook.
    const origCollect = window._i4gCollectHook;
    window._i4gCollectHook = function (data) {
      return enrichI4GOrderData(data, form);
    };
  }

  /* ── Auto-init: observe ffFields for visibility changes ──────── */
  function observeFFFields() {
    // Look for both diamond and membership containers
    // They may already exist in the DOM (services.html static) or be injected
    const ffFields = document.getElementById('ffFields');
    if (!ffFields) return;

    let loaded = false;

    const tryLoad = function () {
      if (loaded) return;
      if (ffFields.style.display !== 'none' && ffFields.offsetParent !== null) {
        loaded = true;
        loadAndRenderProducts();
        injectCheckPlayerUI();
      }
    };

    const observer = new MutationObserver(tryLoad);
    observer.observe(ffFields, { attributes: true, attributeFilter: ['style', 'class'] });
    tryLoad();

    // Patch openServiceModal so products load when FF modal opens
    const originalOpen = window.openServiceModal;
    window.openServiceModal = function (serviceName, fieldsType) {
      if (typeof originalOpen === 'function') {
        originalOpen(serviceName, fieldsType);
      }
      if (fieldsType === 'ff' && !loaded) {
        setTimeout(() => {
          loaded = true;
          loadAndRenderProducts();
          setTimeout(injectCheckPlayerUI, 100);
        }, 80);
      } else if (fieldsType === 'ff') {
        setTimeout(injectCheckPlayerUI, 100);
      }
    };

    patchServiceModal();
  }

  /* ── Bootstrap ───────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeFFFields);
  } else {
    observeFFFields();
  }

})();
