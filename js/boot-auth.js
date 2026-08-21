/* ============================================================
   Zero-latency auth boot
   ------------------------------------------------------------
   Runs SYNCHRONOUSLY in <head>, before any paint, so a returning
   visitor never sees the logged-out UI flash while Firebase
   re-validates the session in the background.

   It paints from localStorage('rh_user_cache'):
     - hides the Login button, shows the avatar (with the real photo)
     - restores the cached balance
     - reveals auth-gated page sections and hides the "login required"
       states, so pages like the dashboard/wallet/checkout render their
       real layout on the very first frame

   auth.js remains the source of truth: when Firebase resolves it either
   confirms this optimistic state (nothing moves) or, if the session is
   genuinely gone, rolls it back via rabbi:loggedout.
   ============================================================ */
(function () {
  'use strict';

  /* Keep Render from sleeping (15 min idle). Ping health every 10 min
     while a tab is open. GitHub Action also pings even if nobody is browsing. */
  (function keepRenderAwake() {
    var url = 'https://rabbi-backend-vlr7.onrender.com/api/health';
    function ping() {
      try {
        fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store', keepalive: true }).catch(function () {});
      } catch (e) {}
    }
    ping();
    setInterval(ping, 10 * 60 * 1000);
  })();

  /* Theme — apply before first paint (light is the default). */
  (function () {
    var t = 'light';
    try { t = localStorage.getItem('rh_theme') || 'light'; } catch (e) { t = 'light'; }
    document.documentElement.setAttribute('data-theme', t);
    window.rhGetTheme = function () {
      try { return localStorage.getItem('rh_theme') || 'light'; } catch (e) { return 'light'; }
    };
    window.rhSetTheme = function (next) {
      try { localStorage.setItem('rh_theme', next); } catch (e) {}
      document.documentElement.setAttribute('data-theme', next);
      try { window.dispatchEvent(new CustomEvent('rh:theme', { detail: next })); } catch (e) {}
    };

    /* Preview / localhost: drop the service worker so CSS/JS edits show instantly. */
    try {
      var h = location.hostname || '';
      var isPrev = h === 'localhost' || h === '127.0.0.1' ||
        h.indexOf('e2b.app') !== -1 || h.indexOf('e2b.dev') !== -1;
      if (isPrev && navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          regs.forEach(function (r) { r.unregister(); });
        });
        if (window.caches) {
          caches.keys().then(function (keys) {
            keys.forEach(function (k) { caches.delete(k); });
          });
        }
      }
    } catch (e) {}

    /* Preview-only page switcher (sandbox / localhost). Never on production. */
    (function previewNav() {
      var host = '';
      try { host = location.hostname || ''; } catch (e) { return; }
      var local = host === 'localhost' || host === '127.0.0.1' ||
        host.indexOf('e2b.app') !== -1 || host.indexOf('e2b.dev') !== -1 ||
        /\.local$/.test(host);
      if (!local) return;
      function paint() {
        if (document.getElementById('rh-preview-nav')) return;
        var bar = document.createElement('nav');
        bar.id = 'rh-preview-nav';
        bar.setAttribute('aria-label', 'Preview pages');
        var pages = [
          ['/', 'Home'],
          ['/services/', 'Services'],
          ['/checkout/?service=meta-verified', 'Checkout'],
          ['/cart/', 'Cart'],
          ['/add-credit/', 'Add Credit'],
          ['/dashboard/', 'Dashboard'],
          ['/dashboard/?tab=orders', 'Orders'],
          ['/settings/', 'Settings'],
          ['/support-tickets/', 'Tickets'],
          ['/about/', 'About'],
          ['/faq/', 'FAQ'],
          ['/portfolio/', 'Portfolio'],
          ['/admin/', 'Admin'],
          ['/privacy-policy/', 'Privacy'],
          ['/terms/', 'Terms'],
          ['/refund-policy/', 'Refund'],
          ['/delivery-policy/', 'Delivery']
        ];
        var path = (location.pathname || '/').replace(/index\.html$/, '');
        if (!path.endsWith('/')) path += '/';
        if (path === '//') path = '/';
        var html = '<div class="rh-pn-inner">';
        for (var i = 0; i < pages.length; i++) {
          var href = pages[i][0];
          var base = href.split('?')[0];
          var on = (base === '/' ? (location.pathname === '/' || location.pathname === '/index.html')
            : (location.pathname.indexOf(base) === 0));
          html += '<a href="' + href + '"' + (on ? ' class="on"' : '') + '>' + pages[i][1] + '</a>';
        }
        html += '</div>';
        bar.innerHTML = html;
        var css = document.createElement('style');
        css.id = 'rh-preview-nav-css';
        css.textContent =
          '#rh-preview-nav{position:fixed;left:0;right:0;top:0;z-index:2147483000;background:#111;border-bottom:1px solid #333;padding:6px 8px;}' +
          '#rh-preview-nav .rh-pn-inner{display:flex;gap:6px;overflow-x:auto;max-width:1320px;margin:0 auto;scrollbar-width:thin}' +
          '#rh-preview-nav a{flex:none;color:#ddd;text-decoration:none;font:700 11px/1 system-ui,sans-serif;padding:7px 10px;border-radius:999px;border:1px solid #333;white-space:nowrap}' +
          '#rh-preview-nav a.on,#rh-preview-nav a:hover{background:#fff;color:#111;border-color:#fff}' +
          'html body .navbar{top:40px!important}' +
          'html{scroll-padding-top:40px;--nav-h:112px}' +
          '@media(max-width:899px){html{--nav-h:104px}}';
        (document.head || document.documentElement).appendChild(css);
        (document.body || document.documentElement).appendChild(bar);
      }
      if (document.body) paint();
      else document.addEventListener('DOMContentLoaded', paint);
    })();

    /* Light-theme sheet is appended last so it beats page-inline leftovers. */
    (function mountLightCss() {
      function place() {
        var host = document.body || document.head || document.documentElement;
        var existing = document.getElementById('rh-light-theme-link');
        var link = existing || document.createElement('link');
        link.id = 'rh-light-theme-link';
        link.rel = 'stylesheet';
        link.href = '/css/light-theme.css?v=14';
        if (link.parentNode !== host) host.appendChild(link);
        var cta = document.getElementById('rh-cta-light-link');
        if (!cta) {
          cta = document.createElement('link');
          cta.id = 'rh-cta-light-link';
          cta.rel = 'stylesheet';
          cta.href = '/css/cta-light.css?v=2';
        }
        if (cta.parentNode !== host) host.appendChild(cta);
        var fs = document.getElementById('rh-fullscreen-link');
        if (!fs) {
          fs = document.createElement('link');
          fs.id = 'rh-fullscreen-link';
          fs.rel = 'stylesheet';
          fs.href = '/css/fullscreen.css?v=3';
        }
        if (fs.parentNode !== host) host.appendChild(fs);
        var cd = document.getElementById('rh-cta-dark-link');
        if (!cd) {
          cd = document.createElement('link');
          cd.id = 'rh-cta-dark-link';
          cd.rel = 'stylesheet';
          cd.href = '/css/cta-dark.css?v=5';
        }
        if (cd.parentNode !== host) host.appendChild(cd);
        if (!document.getElementById('rh-cta-inline')) {
          var inline = document.createElement('style');
          inline.id = 'rh-cta-inline';
          inline.textContent =
            'html[data-theme="light"] .nav-cta,html[data-theme="light"] .home-svc-action,html[data-theme="light"] .service-apply-btn,html[data-theme="light"] .btn-primary,html[data-theme="light"] .hero-all-services,html[data-theme="light"] .submit-btn,html[data-theme="light"] #floatChatToggle{background:#fff!important;background-image:none!important;color:#111!important;border:1px solid #111!important}' +
            'html[data-theme="light"] #floatChatToggle svg{color:#111!important;stroke:currentColor!important}' +
            'html[data-theme="light"] .nav-links.open a.active{background:#fff!important;color:#111!important;border:1.5px solid #111!important}' +
            'html[data-theme="light"] .nav-links.open a.active .nav-icon,html[data-theme="light"] .nav-links.open a.active .nav-icon svg,html[data-theme="light"] .nav-links.open a.active span{background:#f0f0ee!important;color:#111!important}' +
            'html[data-theme="light"] #serviceCheckoutPanel #buyWithCreditBtn,html[data-theme="light"] #serviceCheckoutPanel #instantPayBtn,html[data-theme="light"] #serviceCheckoutPanel #buyWithCreditBtn.sel,html[data-theme="light"] #serviceCheckoutPanel #instantPayBtn.sel,html[data-theme="light"] .cart-pay,html[data-theme="light"] .cx-pay,html[data-theme="light"] #cartPayBalance,html[data-theme="light"] #cartPayInstant{background:#fff!important;color:#111!important;border:1.5px solid #c4c4c0!important}' +
            'html[data-theme="light"] .cart-pay .p-name,html[data-theme="light"] .cx-pay-name{color:#161616!important}' +
            'html[data-theme="light"] .cart-pay .p-desc,html[data-theme="light"] .cx-pay-desc{color:#6f6f6c!important}' +
            'html[data-theme="light"] #serviceCheckoutPanel #buyWithCreditBtn.sel,html[data-theme="light"] #serviceCheckoutPanel #instantPayBtn.sel,html[data-theme="light"] .cart-pay.sel,html[data-theme="light"] .cx-pay.sel,html[data-theme="light"] #cartPayBalance.sel,html[data-theme="light"] #cartPayInstant.sel{background:#fff!important;color:#111!important;border:2.5px solid #111!important}html[data-theme="light"] #serviceCheckoutPanel #buyWithCreditBtn .cx-pay-name,html[data-theme="light"] #serviceCheckoutPanel #buyWithCreditBtn .cx-pay-desc,html[data-theme="light"] #serviceCheckoutPanel #instantPayBtn .cx-pay-name,html[data-theme="light"] #serviceCheckoutPanel #instantPayBtn .cx-pay-desc,html[data-theme="light"] #serviceCheckoutPanel #buyWithCreditBtn.sel .cx-pay-name,html[data-theme="light"] #serviceCheckoutPanel #buyWithCreditBtn.sel .cx-pay-desc{color:#111!important}' +
            'html[data-theme="light"] .cart-pay.sel .p-name,html[data-theme="light"] .cart-pay.sel .p-desc,html[data-theme="light"] .cx-pay.sel .cx-pay-name,html[data-theme="light"] .cx-pay.sel .cx-pay-desc{color:#111!important}html[data-theme="light"] #servicePriceBdt,html[data-theme="light"] .service-price-pill small,html[data-theme="light"] .rh-cx-body .opt .p,html[data-theme="light"] .rh-cx-body .pkg-toggle .pt-price{color:#111!important}' +
            'html[data-theme="dark"] #buyWithCreditBtn.sel,html[data-theme="dark"] #instantPayBtn.sel,html[data-theme="dark"] #cartPayBalance.sel,html[data-theme="dark"] #cartPayInstant.sel,html[data-theme="dark"] .cx-pay.sel,html[data-theme="dark"] .cart-pay.sel{background:#161616!important;color:#f5f5f3!important;border:2px solid #fff!important}' +
            'html[data-theme="dark"] #buyWithCreditBtn.sel span,html[data-theme="dark"] #instantPayBtn.sel span,html[data-theme="dark"] #cartPayBalance.sel span,html[data-theme="dark"] #cartPayInstant.sel span,html[data-theme="dark"] .cx-pay.sel .cx-pay-name,html[data-theme="dark"] .cx-pay.sel .cx-pay-desc,html[data-theme="dark"] .cart-pay.sel .p-name,html[data-theme="dark"] .cart-pay.sel .p-desc{color:#f5f5f3!important;background:transparent!important}' +
            'html[data-theme="light"] .cart-item-check,html[data-theme="light"] .cart-selectall input[type=checkbox],html[data-theme="light"] .cart-item-check-slot{-webkit-appearance:none!important;appearance:none!important;width:22px!important;height:22px!important;box-sizing:border-box!important;border:2.5px solid #111!important;background:#fff!important;border-radius:7px!important}' +
            'html[data-theme="light"] .cart-item-check:checked,html[data-theme="light"] .cart-selectall input[type=checkbox]:checked{background:#111!important;border-color:#111!important}';
          host.appendChild(inline);
        }
      }
      place();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', place);
      }
      window.addEventListener('load', place);
    })();

    /* Bottom nav: keep the bar still across pages, paint active on press. */
    (function bottomNavFeel() {
      if (!document.querySelector('meta[name="view-transition"]')) {
        var meta = document.createElement('meta');
        meta.setAttribute('name', 'view-transition');
        meta.setAttribute('content', 'same-origin');
        (document.head || document.documentElement).appendChild(meta);
      }
      if (!document.getElementById('rh-bnav-feel')) {
        var css = document.createElement('style');
        css.id = 'rh-bnav-feel';
        css.textContent =
          '@view-transition{navigation:auto}' +
          '.rabbi-bottom-nav{view-transition-name:rh-bnav;contain:layout style}' +
          '::view-transition-old(rh-bnav),::view-transition-new(rh-bnav){animation:none;mix-blend-mode:normal;height:100%}' +
          '::view-transition-group(rh-bnav){animation-duration:.01s}' +
          '::view-transition-old(root){animation:rhVtOut .14s ease both}' +
          '::view-transition-new(root){animation:rhVtIn .16s ease both}' +
          '@keyframes rhVtOut{to{opacity:0}}@keyframes rhVtIn{from{opacity:0}}' +
          '.rabbi-bottom-nav a{-webkit-tap-highlight-color:transparent;transition:background .14s ease,color .14s ease,transform .12s ease}' +
          '.rabbi-bottom-nav a:active{transform:scale(.96)}' +
          'html[data-theme="light"] .rabbi-bottom-nav a:hover:not(.active){background:rgba(0,0,0,.06)!important;color:#111!important}' +
          'html[data-theme="light"] .rabbi-bottom-nav a.active{background:#111!important;color:#fff!important}' +
          'html[data-theme="dark"] .rabbi-bottom-nav a:hover:not(.active){background:rgba(255,255,255,.08)!important;color:#fff!important}' +
          'html[data-theme="dark"] .rabbi-bottom-nav a.active{background:#fff!important;color:#080808!important}';
        (document.head || document.documentElement).appendChild(css);
      }
      function mark(a) {
        var nav = a && a.closest ? a.closest('.rabbi-bottom-nav') : null;
        if (!nav) return;
        nav.querySelectorAll('a.active').forEach(function (x) { x.classList.remove('active'); });
        a.classList.add('active');
      }
      function onPress(e) {
        var a = e.target && e.target.closest ? e.target.closest('.rabbi-bottom-nav a') : null;
        if (!a) return;
        mark(a);
        try {
          if (a.href && !document.querySelector('link[data-rh-pre="' + a.href + '"]')) {
            var pre = document.createElement('link');
            pre.rel = 'prefetch';
            pre.href = a.href;
            pre.setAttribute('data-rh-pre', a.href);
            document.head.appendChild(pre);
          }
        } catch (err) {}
      }
      document.addEventListener('pointerdown', onPress, true);
      document.addEventListener('click', onPress, true);
    })();
  })();

  var cached = null;
  try { cached = JSON.parse(localStorage.getItem('rh_user_cache') || 'null'); } catch (e) {}

  var html = document.documentElement;

  if (!cached || !cached.uid) {
    html.classList.add('rh-guest');
    return;
  }

  html.classList.add('rh-authed');

  // 1. Paint the shell before first frame — no flash, no reflow later.
  var style = document.createElement('style');
  style.id = 'rh-instant-auth';
  style.textContent =
    '#navLoginBtn{display:none!important}' +
    '#navUserAvatar{display:flex!important}' +
    // auth-gated regions: show real content, hide the login prompts
    '.rh-authed #authRequired,' +
    '.rh-authed #checkoutAuthGate,' +
    '.rh-authed #dashboardLoginRequired,' +
    '.rh-authed #dashAuthRequired,' +
    '.rh-authed #cartLoginGate,' +
    '.rh-authed #settingsLoginGate,' +
    '.rh-authed #ticketsLoginGate{display:none!important}' +
    '.rh-authed #walletContent,' +
    '.rh-authed #dashboardContent,' +
    '.rh-authed #cartContent,' +
    '.rh-authed #settingsContent,' +
    '.rh-authed #ticketsContent{display:block!important}' +
    // skeleton shimmer for values that only Firestore can supply
    '.rh-authed .rh-skel{color:transparent!important;background:linear-gradient(90deg,#161616 25%,#1f1f1f 37%,#161616 63%);' +
      'background-size:400% 100%;animation:rhSkel 1.1s ease infinite;border-radius:8px}' +
    '@keyframes rhSkel{0%{background-position:100% 50%}100%{background-position:0 50%}}' +
    // avoid a flash of the empty-state before JS fills in data
    '.rh-authed .auth-only{visibility:visible}';
  (document.head || html).appendChild(style);

  function isAuthDefaultPhoto(url) {
    return /googleusercontent\.com|ggpht\.com|gravatar\.com/i.test(String(url || ''));
  }

  function pickCachedPhoto() {
    var live = null;
    try { live = JSON.parse(localStorage.getItem('rh_user_cache') || 'null'); } catch (e) {}
    if (live && live.uid) cached = live;
    var stored = '';
    try { stored = localStorage.getItem('rh_photo_custom') || ''; } catch (e) {}
    var fromCache = (cached && cached.photoURL) || '';
    if (stored && !isAuthDefaultPhoto(stored)) return stored;
    if (fromCache && !isAuthDefaultPhoto(fromCache)) return fromCache;
    return stored || fromCache || '';
  }

  // 2. Fill the avatar + balance as soon as the nodes exist.
  function hydrate() {
    var img = document.getElementById('navUserImg');
    var initial = document.getElementById('navUserInitial');
    var avatar = document.getElementById('navUserAvatar');
    var photo = pickCachedPhoto();

    if (avatar) avatar.style.display = 'flex';

    if (img && photo) {
      var showing = img.getAttribute('src') || '';
      if (isAuthDefaultPhoto(photo) && showing && !isAuthDefaultPhoto(showing)) {
        photo = showing;
      }
      if (img.getAttribute('src') !== photo) img.src = photo;
      img.style.display = 'block';
      if (initial) initial.style.display = 'none';
    } else if (initial) {
      var src = (cached && (cached.displayName || cached.email)) || 'U';
      initial.textContent = src.trim().charAt(0).toUpperCase();
      initial.style.display = 'block';
      if (img) img.style.display = 'none';
    }

    // Cached balance — replaced by the live value moments later.
    // NOTE: these ids must match the real markup. 'dashboardBalance' lives in
    // /dashboard/, 'profileMenuBalance' is injected by auth.js's profile menu.
    // The legacy ids are kept so nothing regresses if markup is added back.
    if (cached.balance) {
      ['dashboardBalance', 'profileMenuBalance', 'userCredit', 'miniCredit',
       'navBalance', 'profileBalanceValue', 'dashBalanceValue', 'walletBalanceValue']
        .forEach(function (id) {
          var el = document.getElementById(id);
          if (el && !el.dataset.rhLive) el.textContent = cached.balance;
        });
    }

    ['profileMenuName', 'profileName'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && cached.displayName) {
        var badge = el.querySelector('.user-verify-badge');
        el.textContent = cached.displayName;
        if (badge) el.appendChild(badge);
      }
    });
    ['profileMenuEmail', 'profileEmail'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && cached.email) el.textContent = cached.email;
    });

    // Dashboard profile card — paint from cache so it is never blank.
    var dn = document.getElementById('dashboardName');
    if (dn && cached.displayName) {
      var badge = dn.querySelector('.user-verify-badge');
      dn.textContent = cached.displayName;
      if (badge) dn.appendChild(badge);
    }
    var de = document.getElementById('dashboardEmail');
    if (de && cached.email) de.textContent = cached.email;

    var av = document.getElementById('dashboardAvatar');
    if (av) {
      if (photo) {
        var existing = av.querySelector('img');
        var shown = existing ? (existing.getAttribute('src') || '') : '';
        if (isAuthDefaultPhoto(photo) && shown && !isAuthDefaultPhoto(shown)) {
          photo = shown;
        }
        if (existing) {
          if (existing.getAttribute('src') !== photo) existing.src = photo;
        } else {
          var im = document.createElement('img');
          im.src = photo;
          im.alt = '';
          im.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block';
          av.textContent = '';
          av.appendChild(im);
        }
      } else {
        var s0 = (cached.displayName || cached.email || 'U').trim().charAt(0).toUpperCase();
        if (av.textContent.trim() === 'U' || !av.textContent.trim()) av.textContent = s0;
      }
    }

    // Lists that must come from Firestore: show a shimmer, not an empty box.
    ['dashboardOrderHistory', 'dashboardPaymentHistory', 'dashboardOrders', 'dashboardTransactions', 'ordersList', 'txList']
      .forEach(function (id) {
        var el = document.getElementById(id);
        if (el && !el.children.length && !el.dataset.rhSkel) {
          el.dataset.rhSkel = '1';
          var rows = '';
          for (var i = 0; i < 3; i++) rows += '<div class="rh-skel" style="height:64px;margin-bottom:10px"></div>';
          el.innerHTML = rows;
        }
      });
  }

  // auth.js builds the profile menu lazily (first avatar click), long after
  // the poll below gives up — let it repaint from cache the moment it exists.
  window.rhPaintCachedAuth = hydrate;

  // The nav is injected by auth.js, so retry briefly until it lands.
  var tries = 0;
  (function poll() {
    hydrate();
    var img = document.getElementById('navUserImg');
    var empty = img && !(img.getAttribute('src') || '');
    if (++tries < 80 && (!img || empty)) {
      setTimeout(poll, 25);
    }
  })();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate);
  }

  // 3. If Firebase says the session is really gone, undo the optimism.
  window.addEventListener('rabbi:loggedout', function () {
    html.classList.remove('rh-authed');
    html.classList.add('rh-guest');
    var s = document.getElementById('rh-instant-auth');
    if (s && s.parentNode) s.parentNode.removeChild(s);
  });
})();
