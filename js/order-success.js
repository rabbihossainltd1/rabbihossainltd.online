/* Dedicated order-success page — no chrome, no auto-redirect. */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function moneyUsd(v) {
    var n = Number(v || 0);
    if (!n) return '';
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: n < 1 ? 3 : 2, maximumFractionDigits: 4 });
  }

  function moneyBdt(v) {
    var n = Math.round(Number(v || 0));
    if (!n) return '';
    return '৳' + n.toLocaleString('en-BD');
  }

  function readPayload() {
    var raw = null;
    try { raw = localStorage.getItem('rh_order_success'); } catch (e) {}
    if (!raw) {
      try { raw = sessionStorage.getItem('rh_order_success'); } catch (e2) {}
    }
    if (!raw) return null;
    try {
      var data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : null;
    } catch (e) {
      return null;
    }
  }

  var copySvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

  var data = readPayload() || {};
  var body = document.getElementById('osBody');
  if (!body) return;

  var usd = moneyUsd(data.amountUsd);
  var bdt = moneyBdt(data.amountBdt || (Number(data.amountUsd || 0) * 125));
  var status = String(data.status || 'processing');
  var statusLabel = /deliver/i.test(status) ? 'Delivered' : 'Processing';
  var service = data.serviceName || (data.count ? (data.count + ' items') : '');
  var rows = '';

  if (service) rows += '<div class="os-row"><span class="os-k">Service</span><span class="os-v">' + esc(service) + '</span></div>';
  if (data.packageName) rows += '<div class="os-row"><span class="os-k">Package</span><span class="os-v">' + esc(data.packageName) + '</span></div>';
  if (data.playerName) rows += '<div class="os-row"><span class="os-k">Player</span><span class="os-v">' + esc(data.playerName) + '</span></div>';
  if (data.uid) rows += '<div class="os-row"><span class="os-k">UID</span><span class="os-v">' + esc(data.uid) + '</span></div>';
  if (data.orderId) {
    rows += '<div class="os-row"><span class="os-k">Order ID</span><span class="os-id"><span class="os-v" id="osOrderId">' + esc(data.orderId) + '</span>' +
      '<button type="button" class="os-copy" id="osCopyId" aria-label="Copy order ID" title="Copy">' + copySvg + '</button></span></div>';
  }
  if (data.count) rows += '<div class="os-row"><span class="os-k">Items</span><span class="os-v">' + esc(data.count) + '</span></div>';

  var html = '';
  if (usd || bdt) {
    html += '<div class="os-pills">';
    if (usd) html += '<span>' + esc(usd) + '</span>';
    if (bdt) html += '<span>' + esc(bdt) + '</span>';
    html += '<span>' + esc(statusLabel) + '</span></div>';
  }
  if (rows) html += '<div class="os-meta">' + rows + '</div>';

  if (data.key) {
    html += '<div class="os-key"><label>Your key</label><code id="osKeyVal">' + esc(data.key) + '</code></div>';
    html += '<button class="os-btn os-btn-light" type="button" id="osCopyKey" style="margin-bottom:12px">Copy key</button>';
  }

  body.innerHTML = html;

  function copyText(text, btn) {
    if (!text) return;
    navigator.clipboard.writeText(String(text)).then(function () {
      if (!btn) return;
      btn.classList.add('is-ok');
      var prev = btn.innerHTML;
      btn.innerHTML = checkSvg;
      setTimeout(function () {
        btn.classList.remove('is-ok');
        btn.innerHTML = prev;
      }, 1600);
    }).catch(function () {});
  }

  var copyId = document.getElementById('osCopyId');
  if (copyId && data.orderId) {
    copyId.addEventListener('click', function () { copyText(data.orderId, copyId); });
  }

  var copyKey = document.getElementById('osCopyKey');
  if (copyKey && data.key) {
    copyKey.addEventListener('click', function () {
      navigator.clipboard.writeText(String(data.key)).then(function () {
        copyKey.textContent = 'Copied';
        setTimeout(function () { copyKey.textContent = 'Copy key'; }, 1600);
      }).catch(function () {});
    });
  }

  var rateBtn = document.getElementById('osRateBtn');
  if (rateBtn) {
    rateBtn.addEventListener('click', function () {
      window.location.href = '/dashboard/?tab=orders';
    });
  }
})();
