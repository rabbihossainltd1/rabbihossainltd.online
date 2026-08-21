/* Dedicated order-success page — no auto-redirect to My Orders. */
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
    try {
      var raw = sessionStorage.getItem('rh_order_success');
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      return data;
    } catch (e) {
      return null;
    }
  }

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
  if (data.orderId) rows += '<div class="os-row"><span class="os-k">Order ID</span><span class="os-v">' + esc(data.orderId) + '</span></div>';
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

  var copyBtn = document.getElementById('osCopyKey');
  if (copyBtn && data.key) {
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(String(data.key)).then(function () {
        copyBtn.textContent = 'Copied';
        setTimeout(function () { copyBtn.textContent = 'Copy key'; }, 1800);
      }).catch(function () {});
    });
  }

  var rateBtn = document.getElementById('osRateBtn');
  if (rateBtn) {
    rateBtn.addEventListener('click', function () {
      if (typeof window.openReviewModal === 'function') {
        window.openReviewModal(service || '');
      }
    });
  }
})();
