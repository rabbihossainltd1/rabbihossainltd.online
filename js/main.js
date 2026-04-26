/* ============================================================
   Rabbi.dev — Main JavaScript  v2.2
   Amazon-style drawer menu
   ============================================================ */

(function () {
  'use strict';

  /* ── Navbar scroll behaviour ──────────────────────────── */
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });
  }

  /* ── Mobile nav drawer ────────────────────────────────── */
  const hamburger = document.getElementById('hamburger') || document.querySelector('.nav-hamburger');
  const navLinks  = document.getElementById('navLinks') || document.querySelector('.nav-links');

  let backdrop = document.getElementById('navBackdrop');

  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'navBackdrop';
    document.body.appendChild(backdrop);
  }

  function setHamburgerState(isOpen) {
    if (!hamburger) return;

    hamburger.setAttribute('aria-expanded', String(isOpen));

    const spans = hamburger.querySelectorAll('span');

    if (spans.length >= 3) {
      spans[0].style.transform = isOpen ? 'rotate(45deg) translate(5px, 5px)' : '';
      spans[1].style.opacity   = isOpen ? '0' : '';
      spans[2].style.transform = isOpen ? 'rotate(-45deg) translate(5px, -5px)' : '';
    }
  }

  function openMenu() {
    if (!navLinks) return;

    navLinks.classList.add('open');
    document.body.classList.add('menu-open');
    backdrop.classList.add('show');
    document.body.style.overflow = 'hidden';

    setHamburgerState(true);
  }

  function closeMenu() {
    if (!navLinks) return;

    navLinks.classList.remove('open');
    document.body.classList.remove('menu-open');
    backdrop.classList.remove('show');
    document.body.style.overflow = '';

    setHamburgerState(false);
  }

  function toggleMenu() {
    if (!navLinks) return;

    if (navLinks.classList.contains('open')) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  if (hamburger && navLinks) {
    hamburger.setAttribute('aria-controls', navLinks.id || 'navLinks');
    hamburger.setAttribute('aria-expanded', 'false');

    hamburger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
    });

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');

        /* Smooth scroll for same-page anchor links (e.g. #contact) */
        if (href && href.startsWith('#')) {
          e.preventDefault();
          closeMenu();
          const target = document.querySelector(href);
          if (target) {
            setTimeout(() => {
              const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 70;
              const top  = target.getBoundingClientRect().top + window.scrollY - navH;
              window.scrollTo({ top, behavior: 'smooth' });
            }, 50); /* slight delay lets drawer close first */
          }
          return;
        }

        closeMenu();
      });
    });

    backdrop.addEventListener('click', closeMenu);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) closeMenu();
    }, { passive: true });
  }

  /* ── Active nav link ──────────────────────────────────── */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    const linkPage = href.split('/').pop().split('#')[0] || 'index.html';
    if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
      link.classList.add('active');
    }
  });

  /* ── Stagger children FIRST ───────────────────────────── */
  document.querySelectorAll('[data-stagger]').forEach(parent => {
    const delay = parseFloat(parent.dataset.stagger) || 0.1;
    Array.from(parent.children).forEach((child, i) => {
      child.style.transitionDelay = `${i * delay}s`;
      child.classList.add('reveal');
    });
  });

  /* ── Scroll reveal ────────────────────────────────────── */
  function initReveal() {
    const reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;

    if (!('IntersectionObserver' in window)) {
      reveals.forEach(el => el.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
    );
    reveals.forEach(el => observer.observe(el));
  }
  initReveal();

  /* ── Counter animation ────────────────────────────────── */
  function animateCounter(el) {
    const target = parseFloat(el.dataset.target);
    if (isNaN(target)) return;
    const suffix  = el.dataset.suffix || '';
    const dur     = 1400;
    const start   = performance.now();
    const isFloat = target % 1 !== 0;
    function step(now) {
      const progress = Math.min((now - start) / dur, 1);
      const ease     = 1 - Math.pow(1 - progress, 3);
      const value    = target * ease;
      el.textContent = (isFloat ? value.toFixed(1) : Math.round(value)) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const counters = document.querySelectorAll('[data-target]');
  if (counters.length && 'IntersectionObserver' in window) {
    const cObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            cObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach(el => cObserver.observe(el));
  }

  /* ── Parallax hero bg ─────────────────────────────────── */
  const heroBgImg = document.querySelector('.hero-bg-img');
  if (heroBgImg) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          heroBgImg.style.transform = `translateY(${window.scrollY * 0.1}px)`;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ── Portfolio equal heights ──────────────────────────── */
  function setPortfolioHeights() {
    const items = document.querySelectorAll('.portfolio-item-lg, .portfolio-item-sm');
    if (!items.length) return;
    if (window.innerWidth <= 768) {
      items.forEach(el => el.style.height = '');
      return;
    }
    let maxH = 0;
    items.forEach(el => { el.style.height = ''; maxH = Math.max(maxH, el.offsetHeight); });
    items.forEach(el => el.style.height = maxH + 'px');
  }
  window.addEventListener('load', setPortfolioHeights);
  window.addEventListener('resize', setPortfolioHeights, { passive: true });

  /* ── Contact form — Formspree integration ─────────────── */
  const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mojybwvn';

  const form      = document.getElementById('contactForm');
  const statusEl  = document.getElementById('formStatus');
  const submitBtn = document.getElementById('contactSubmitBtn');

  if (form && statusEl && submitBtn) {
    const ORIGINAL_BTN_HTML = submitBtn.innerHTML;

    function setStatus(type, message) {
      statusEl.className   = 'status-' + type;
      statusEl.textContent = message;
      statusEl.style.display = 'block';
    }

    function clearStatus() {
      statusEl.className   = '';
      statusEl.textContent = '';
      statusEl.style.display = 'none';
    }

    function setLoading(loading) {
      submitBtn.disabled  = loading;
      submitBtn.innerHTML = loading ? 'Sending…' : ORIGINAL_BTN_HTML;
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearStatus();

      /* Basic client-side validation */
      const name    = form.querySelector('#name').value.trim();
      const email   = form.querySelector('#email').value.trim();
      const message = form.querySelector('#message').value.trim();

      if (!name || !email || !message) {
        setStatus('error', 'Please fill in your name, email, and message.');
        return;
      }

      setLoading(true);

      try {
        const response = await fetch(FORMSPREE_ENDPOINT, {
          method : 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body   : JSON.stringify({ name, email, subject: form.querySelector('#subject').value.trim(), message })
        });

        const result = await response.json();

        if (response.ok) {
          /* Hide form, show beautiful success */
          form.style.display = 'none';
          statusEl.className = 'status-success';
          statusEl.innerHTML =
            '<div class="fs-icon">✓</div>' +
            '<div class="fs-title">Message Sent Successfully!</div>' +
            '<div class="fs-body">Thank you for reaching out. I\'ve received your message and will get back to you within <strong style="color:#4dffaa;">24–48 hours</strong>.</div>' +
            '<div class="fs-tag">• Response within 24–48 hrs •</div>';
          statusEl.style.display = 'flex';
          form.reset();
        } else {
          /* Formspree returns errors array */
          const errMsg = (result.errors && result.errors.length)
            ? result.errors.map(function(err){ return err.message; }).join(', ')
            : 'Something went wrong.';
          setStatus('error', '⚠ ' + errMsg + ' Please try again or email directly.');
        }
      } catch (err) {
        setStatus('error', '⚠ Network error. Please check your connection and try again.');
        console.error('Contact form error:', err);
      } finally {
        setLoading(false);
      }
    });
  }

  /* ── Filter buttons ───────────────────────────────────── */
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

})();

/* ── BANGLA TRANSLATION ─────────────────────────────── */
(function() {
  const lang = localStorage.getItem('siteLang') || 'en';
  if (lang !== 'bn') return;
  const translations = {
    'Home': 'হোম',
    'Services': 'সেবা',
    'Portfolio': 'পোর্টফোলিও',
    'About': 'আমার সম্পর্কে',
    'Hire Me': 'আমাকে নিযুক্ত করুন',
    'Login': 'লগইন',
    'Sign Out': 'সাইন আউট',
    'Settings': 'সেটিংস',
    'Add Credit': 'ক্রেডিট যোগ করুন',
    'Admin Panel': 'অ্যাডমিন প্যানেল',
    'Balance': 'ব্যালেন্স',
    'Our Services': 'আমাদের সেবা',
    'View Portfolio': 'পোর্টফোলিও দেখুন',
    'Available for Projects': 'প্রজেক্টের জন্য উপলব্ধ',
    'Apply Now': 'এখন আবেদন করুন',
    'Get Your Card': 'কার্ড নিন',
    'Get Now': 'এখন নিন',
    'Get Started': 'শুরু করুন',
    'Top-up Now': 'টপ-আপ করুন',
    'Setup Now': 'সেটআপ করুন',
    'Submit Request': 'অনুরোধ জমা দিন',
    'Buy with Credit': 'ক্রেডিট দিয়ে কিনুন',
    'Buy with Instant Pay': 'ইনস্ট্যান্ট পে দিয়ে কিনুন',
    'Full Name *': 'পূর্ণ নাম *',
    'Email Address *': 'ইমেইল ঠিকানা *',
    'WhatsApp / Phone': 'হোয়াটসঅ্যাপ / ফোন',
  };
  function translateNode(node) {
    if (node.nodeType === 3) {
      const t = node.textContent.trim();
      if (translations[t]) node.textContent = node.textContent.replace(t, translations[t]);
    } else if (node.nodeType === 1 && !['SCRIPT','STYLE','INPUT','TEXTAREA','SELECT'].includes(node.tagName)) {
      node.childNodes.forEach(translateNode);
    }
  }
  document.addEventListener('DOMContentLoaded', function() {
    translateNode(document.body);
    // Add lang indicator
    const indicator = document.createElement('div');
    indicator.style.cssText = 'position:fixed;bottom:14px;left:14px;z-index:9999;background:rgba(0,200,255,0.12);border:1px solid rgba(0,200,255,0.25);color:var(--accent,#00c8ff);font-size:0.7rem;padding:4px 10px;border-radius:20px;font-weight:700;pointer-events:none;';
    indicator.textContent = 'বাংলা';
    document.body.appendChild(indicator);
  });
})();
