/* ============================================================
   Rabbi.dev — Main JS v2.3
   Clean drawer menu — backdrop element approach
   ============================================================ */

(function () {
  'use strict';

  /* ── Navbar scroll ────────────────────────────────────── */
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', function () {
      navbar.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });
  }

  /* ── Drawer menu setup ────────────────────────────────── */
  var hamburger = document.getElementById('hamburger');
  var navLinks  = document.getElementById('navLinks');

  if (!hamburger || !navLinks) return;

  /* Create backdrop element and insert after navbar */
  var backdrop = document.createElement('div');
  backdrop.className = 'nav-drawer-backdrop';
  document.body.appendChild(backdrop);

  function openDrawer() {
    navLinks.classList.add('open');
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
    hamburger.setAttribute('aria-expanded', 'true');
    /* Animate to X */
    var s = hamburger.querySelectorAll('span');
    s[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
    s[1].style.opacity   = '0';
    s[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
  }

  function closeDrawer() {
    navLinks.classList.remove('open');
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
    hamburger.setAttribute('aria-expanded', 'false');
    /* Animate back to hamburger */
    var s = hamburger.querySelectorAll('span');
    s[0].style.transform = '';
    s[1].style.opacity   = '';
    s[2].style.transform = '';
  }

  /* Toggle on hamburger click */
  hamburger.addEventListener('click', function () {
    if (navLinks.classList.contains('open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  /* Close when backdrop is clicked */
  backdrop.addEventListener('click', closeDrawer);

  /* Close when a nav link is clicked — allow navigation */
  var links = navLinks.querySelectorAll('a');
  links.forEach(function (link) {
    link.addEventListener('click', function () {
      closeDrawer();
      /* navigation happens naturally via href */
    });
  });

  /* Close on Escape key */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawer();
  });

  /* ── Active link highlight ────────────────────────────── */
  var page = window.location.pathname.split('/').pop() || 'index.html';
  navLinks.querySelectorAll('a').forEach(function (a) {
    var href = a.getAttribute('href') || '';
    var linkPage = href.split('/').pop().split('#')[0] || 'index.html';
    if (linkPage === page) {
      a.classList.add('active');
    }
  });

  /* ── Stagger children FIRST then reveal ──────────────── */
  document.querySelectorAll('[data-stagger]').forEach(function (parent) {
    var delay = parseFloat(parent.dataset.stagger) || 0.1;
    Array.from(parent.children).forEach(function (child, i) {
      child.style.transitionDelay = (i * delay) + 's';
      child.classList.add('reveal');
    });
  });

  /* ── Scroll reveal ────────────────────────────────────── */
  var reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    if ('IntersectionObserver' in window) {
      var revealObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
      reveals.forEach(function (el) { revealObs.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add('visible'); });
    }
  }

  /* ── Counter animation ────────────────────────────────── */
  var counters = document.querySelectorAll('[data-target]');
  if (counters.length && 'IntersectionObserver' in window) {
    var cObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          cObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { cObs.observe(el); });
  }

  function animateCount(el) {
    var target = parseFloat(el.dataset.target);
    if (isNaN(target)) return;
    var suffix = el.dataset.suffix || '';
    var dur    = 1400;
    var start  = performance.now();
    (function step(now) {
      var p = Math.min((now - start) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * e) + suffix;
      if (p < 1) requestAnimationFrame(step);
    })(start);
  }

  /* ── Parallax hero ────────────────────────────────────── */
  var heroBg = document.querySelector('.hero-bg-img');
  if (heroBg) {
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          heroBg.style.transform = 'translateY(' + (window.scrollY * 0.1) + 'px)';
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ── Contact form ─────────────────────────────────────── */
  var form = document.querySelector('.contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      if (!btn) return;
      var orig = btn.innerHTML;
      btn.innerHTML = 'Message Sent &#10003;';
      btn.disabled  = true;
      setTimeout(function () {
        btn.innerHTML = orig;
        btn.disabled  = false;
        form.reset();
      }, 3000);
    });
  }

  /* ── Filter buttons ───────────────────────────────────── */
  document.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

})();
