/* ============================================================
   Item4Gamer Integration — v1.0
   - Auto product price sync from backend API
   - Player ID / Free Fire UID check
   - Order data enrichment for item4gamer provider
   - All calls go to backend only — NO direct Item4Gamer API key exposed
   ============================================================ */

(function () {
  'use strict';

  const BACKEND_BASE = 'https://rabbi-backend-vlr7.onrender.com';
  const ITEM4GAMER_CATEGORY_ID = 19;
  const BDT_RATE = 125; // 1 USD = 125 BDT

  /* ── Utility: safe deep-get ──────────────────────────────────── */
  function safeGet(obj, ...keys) {
    return keys.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), obj);
  }

  /* ── Normalize product list from any response shape ─────────── */
  function normalizeProductList(raw) {
    if (!raw) return [];
    // Try all known response shapes in order of specificity
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
    if (!product) return 0;
    // Check fields in priority order
    const raw =
      product.amountUsd ??
      product.amountUSD ??
      product.providerPriceUsd ??
      product.price ??
      product.usdPrice ??
      product.amount ??
      0;
    return Math.round(Number(raw) * 10000) / 10000;
  }

  /* ── Normalize product ID ────────────────────────────────────── */
  function normalizeProductId(product) {
    if (!product) return '';
    return String(
      product.productId ??
      product.product_id ??
      product.id ??
      product.itemId ??
      ''
    );
  }

  /* ── Normalize product name ──────────────────────────────────── */
  function normalizeProductName(product) {
    if (!product) return 'Unknown Package';
    return String(
      product.productName ??
      product.product_name ??
      product.name ??
      product.title ??
      'Unknown Package'
    );
  }

  /* ── Fetch products from backend ─────────────────────────────── */
  async function fetchItem4GamerProducts() {
    const url = `${BACKEND_BASE}/api/item4gamer/products?category_id=${ITEM4GAMER_CATEGORY_ID}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      throw new Error(`Backend returned HTTP ${res.status} fetching products.`);
    }
    let raw;
    try {
      raw = await res.json();
    } catch (e) {
      throw new Error('Invalid JSON from backend while fetching products.');
    }
    const products = normalizeProductList(raw);
    // Map each product into a clean normalized shape
    return products.map((p) => ({
      item4gamerProductId: normalizeProductId(p),
      productId: normalizeProductId(p),
      productName: normalizeProductName(p),
      amountUsd: normalizePrice(p),
      amountBDT: Math.round(normalizePrice(p) * BDT_RATE),
      provider: 'item4gamer',
      autoTopupReady: true,
      _raw: p
    })).filter((p) => p.amountUsd > 0); // skip zero-price products
  }

  /* ── Check player ────────────────────────────────────────────── */
  async function checkFreefirePlayer(uid) {
    if (!uid || !String(uid).trim()) {
      return { ok: false, error: 'UID is empty.' };
    }
    const url = `${BACKEND_BASE}/api/item4gamer/check-player`;
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: String(uid).trim(), game: 'freefire' })
      });
    } catch (networkErr) {
      return { ok: false, error: 'Network error checking player. Please try again.' };
    }

    let data;
    try {
      data = await res.json();
    } catch (e) {
      // Non-JSON response — treat as provider-side issue but keep UI stable
      return {
        ok: false,
        error: 'Could not verify player at this time. You may still place the order manually.',
        providerError: true
      };
    }

    if (!res.ok || data.ok === false || data.success === false) {
      const msg =
        data.message ||
        data.error ||
        data.msg ||
        'Player check failed. You may still place the order manually.';
      return { ok: false, error: msg, providerError: true };
    }

    // Normalize player info from any response shape
    const playerInfo = data.data || data.player || data.result || data;
    return {
      ok: true,
      playerName: playerInfo.playerName || playerInfo.name || playerInfo.username || playerInfo.nickname || '',
      server: playerInfo.server || playerInfo.region || playerInfo.zone || '',
      extra: playerInfo
    };
  }

  /* ── Build Diamond SVG icon (inline, reused) ─────────────────── */
  function diamondSVG(color) {
    const c = color || 'currentColor';
    return `<svg viewBox="0 0 24 24" fill="none" style="width:18px;height:18px;display:block;">
      <path d="M6 4h12l4 6-10 10L2 10l4-6Z" fill="${c}" opacity=".22"/>
      <path d="M2 10h20M6 4l3 6 3-6 3 6 3-6M9 10l3 10 3-10" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`;
  }

  /* ── Render product list into the diamond options container ──── */
  function renderDiamondProducts(products, container) {
    if (!container) return;
    container.innerHTML = '';

    if (!products || products.length === 0) {
      container.innerHTML = `<div class="i4g-load-error">No diamond packages available right now.</div>`;
      return;
    }

    const list = document.createElement('div');
    list.className = 'ff-option-list';

    products.forEach((product, idx) => {
      const usdStr = `$${product.amountUsd.toFixed(product.amountUsd < 1 ? 3 : 2)}`;
      const bdtStr = `৳${product.amountBDT.toLocaleString('en-BD')}`;
      const name = product.productName;

      const label = document.createElement('label');
      label.className = 'ff-option-item';
      label.innerHTML = `
        <input
          type="radio"
          name="ff_package"
          value="${name} — ${usdStr} / ${bdtStr}"
          data-product-id="${product.productId}"
          data-item4gamer-product-id="${product.item4gamerProductId}"
          data-game-id="freefire"
          data-package-name="${name}"
          data-amount-usd="${product.amountUsd}"
          data-amount-bdt="${product.amountBDT}"
          data-provider="item4gamer"
        />
        <span class="ff-option-label">
          <span class="ff-pack-icon" aria-hidden="true">${diamondSVG('#66e6ff')}</span>
          ${name}
        </span>
        <span class="ff-option-price">
          <strong>${usdStr}</strong>
          <small>${bdtStr}</small>
        </span>
      `;

      // When this radio is selected, update the price in the checkout panel
      const radio = label.querySelector('input[type=radio]');
      if (radio) {
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

      list.appendChild(label);
    });

    container.appendChild(list);
  }

  /* ── Inject loading / error states into diamond container ────── */
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

    // Don't inject twice
    if (document.getElementById('i4g-check-player-btn')) return;

    // Wrap the input in a relative container if not already
    const formGroup = uidInput.closest('.form-group') || uidInput.parentElement;
    if (!formGroup) return;

    // Build the check-player row below the input
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

    // Inject styles once
    if (!document.getElementById('i4g-check-player-style')) {
      const style = document.createElement('style');
      style.id = 'i4g-check-player-style';
      style.textContent = `
        #i4g-check-player-btn:hover {
          background: rgba(0,200,255,.22) !important;
          border-color: rgba(0,200,255,.60) !important;
        }
        #i4g-check-player-btn:disabled {
          opacity: .6;
          cursor: default !important;
        }
        #i4g-player-status.success {
          background: rgba(0,255,136,.10);
          border: 1px solid rgba(0,255,136,.25);
          color: #a7ffcf;
        }
        #i4g-player-status.error {
          background: rgba(255,80,80,.10);
          border: 1px solid rgba(255,80,80,.22);
          color: #ffb0b0;
        }
        #i4g-player-status.checking {
          background: rgba(0,200,255,.08);
          border: 1px solid rgba(0,200,255,.18);
          color: #9ee8ff;
        }
        .i4g-loading-state {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px;
          color: #7a8ca8;
          font-size: .88rem;
          font-weight: 700;
        }
        .i4g-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(0,200,255,.18);
          border-top-color: #00c8ff;
          border-radius: 50%;
          display: inline-block;
          animation: i4gSpin .7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes i4gSpin { to { transform: rotate(360deg); } }
        .i4g-load-error {
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(255,80,80,.08);
          border: 1px solid rgba(255,80,80,.18);
          color: #ffb0b0;
          font-size: .84rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .i4g-retry-btn {
          border: 1px solid rgba(255,80,80,.35);
          background: rgba(255,80,80,.12);
          color: #ffb0b0;
          border-radius: 8px;
          padding: 5px 12px;
          font-size: .78rem;
          font-weight: 800;
          cursor: pointer;
          margin-left: auto;
        }
        .i4g-retry-btn:hover {
          background: rgba(255,80,80,.22);
        }
      `;
      document.head.appendChild(style);
    }

    // Wire up the check-player button
    const btn = document.getElementById('i4g-check-player-btn');
    if (btn) {
      btn.addEventListener('click', async function () {
        const uid = (document.getElementById('mo_ff_uid')?.value || '').trim();
        const statusEl = document.getElementById('i4g-player-status');

        if (!uid) {
          if (statusEl) {
            statusEl.className = 'error';
            statusEl.textContent = 'Please enter your Free Fire UID first.';
            statusEl.style.display = 'block';
          }
          return;
        }

        btn.disabled = true;
        btn.innerHTML = `<span class="i4g-spinner" style="width:13px;height:13px;border-width:2px;"></span> Checking…`;
        if (statusEl) {
          statusEl.className = 'checking';
          statusEl.textContent = 'Checking player…';
          statusEl.style.display = 'block';
        }

        try {
          const result = await checkFreefirePlayer(uid);
          if (result.ok) {
            const parts = [];
            if (result.playerName) parts.push(`✓ ${result.playerName}`);
            if (result.server) parts.push(`Server: ${result.server}`);
            if (!parts.length) parts.push('✓ Player verified');
            if (statusEl) {
              statusEl.className = 'success';
              statusEl.textContent = parts.join(' · ');
              statusEl.style.display = 'block';
            }
            // Store verified UID so order flow can use it
            window._i4gVerifiedUid = uid;
          } else {
            if (statusEl) {
              statusEl.className = result.providerError ? 'checking' : 'error';
              statusEl.textContent = result.error || 'Player check failed.';
              statusEl.style.display = 'block';
            }
            if (!result.providerError) {
              window._i4gVerifiedUid = null;
            } else {
              // Provider error — allow manual order
              window._i4gVerifiedUid = uid;
            }
          }
        } catch (err) {
          if (statusEl) {
            statusEl.className = 'checking';
            statusEl.textContent = 'Could not verify player. You may still place the order manually.';
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

  /* ── Main: load products and hydrate the FF diamond section ──── */
  async function loadAndRenderProducts() {
    const diamondListContainer = document.getElementById('ffDiamondOptionsList');
    if (!diamondListContainer) return; // Not on a page with the diamond section

    showProductsLoading(diamondListContainer);

    // Provide retry hook
    window._i4gRetryLoad = loadAndRenderProducts;

    let products;
    try {
      products = await fetchItem4GamerProducts();
    } catch (err) {
      console.error('[Item4Gamer] Failed to load products:', err);
      showProductsError(diamondListContainer);
      return;
    }

    if (!products || products.length === 0) {
      showProductsError(diamondListContainer);
      return;
    }

    // Store products globally so service-modal.js can access them
    window._i4gProducts = products;

    renderDiamondProducts(products, diamondListContainer);

    // After rendering, inject the Check Player UI (UID input may now be visible)
    injectCheckPlayerUI();
  }

  /* ── Public API ──────────────────────────────────────────────── */
  window.Item4Gamer = {
    fetchProducts: fetchItem4GamerProducts,
    checkPlayer: checkFreefirePlayer,
    normalizeProductList,
    normalizePrice,
    getProducts: () => window._i4gProducts || [],
    injectCheckPlayerUI,
    loadAndRenderProducts
  };

  /* ── Auto-init: when ffFields becomes visible, load products ─── */
  // We observe the ffFields div for display changes so products load
  // exactly when the FF modal opens, even if opened after page load.
  function observeFFFields() {
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

    // MutationObserver watches for style changes on ffFields
    const observer = new MutationObserver(tryLoad);
    observer.observe(ffFields, { attributes: true, attributeFilter: ['style', 'class'] });

    // Also try immediately in case it's already visible on load
    tryLoad();

    // Patch openServiceModal to trigger load when ff modal is opened
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
        // Already loaded — just make sure check-player UI is there
        setTimeout(injectCheckPlayerUI, 100);
      }
    };
  }

  /* ── Bootstrap ───────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeFFFields);
  } else {
    observeFFFields();
  }

})();
