/* ============================================================
   Rabbi.dev — Main JavaScript
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

  /* ── Mobile nav toggle ────────────────────────────────── */
  const hamburger = document.querySelector('.nav-hamburger');
  const navLinks  = document.querySelector('.nav-links');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      const spans = hamburger.querySelectorAll('span');
      const isOpen = navLinks.classList.contains('open');
      spans[0].style.transform = isOpen ? 'rotate(45deg) translate(4.5px, 4.5px)' : '';
      spans[1].style.opacity   = isOpen ? '0' : '';
      spans[2].style.transform = isOpen ? 'rotate(-45deg) translate(4.5px, -4.5px)' : '';
    });

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        const spans = hamburger.querySelectorAll('span');
        spans[0].style.transform = '';
        spans[1].style.opacity   = '';
        spans[2].style.transform = '';
      });
    });
  }

  /* ── Active nav link ──────────────────────────────────── */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  /* ── Scroll reveal ────────────────────────────────────── */
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    reveals.forEach(el => observer.observe(el));
  }

  /* ── Stagger child animations ─────────────────────────── */
  document.querySelectorAll('[data-stagger]').forEach(parent => {
    const delay = parseFloat(parent.dataset.stagger) || 0.1;
    Array.from(parent.children).forEach((child, i) => {
      child.style.transitionDelay = `${i * delay}s`;
      child.classList.add('reveal');
    });
  });

  /* ── Smooth counter animation ─────────────────────────── */
  function animateCounter(el) {
    const target  = parseFloat(el.dataset.target);
    const suffix  = el.dataset.suffix || '';
    const dur     = 1200;
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
  if (counters.length) {
    const cObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            cObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach(el => cObserver.observe(el));
  }

  /* ── Parallax hero bg (lightweight) ──────────────────── */
  const heroBgImg = document.querySelector('.hero-bg-img');
  if (heroBgImg) {
    window.addEventListener('scroll', () => {
      heroBgImg.style.transform = `translateY(${window.scrollY * 0.12}px)`;
    }, { passive: true });
  }

  /* ── Portfolio item equal heights on load ─────────────── */
  function setPortfolioHeights() {
    const items = document.querySelectorAll('.portfolio-item-lg, .portfolio-item-sm');
    if (!items.length) return;
    if (window.innerWidth <= 768) {
      items.forEach(el => el.style.height = '');
      return;
    }
    let maxH = 0;
    items.forEach(el => {
      el.style.height = '';
      maxH = Math.max(maxH, el.offsetHeight);
    });
  }
  window.addEventListener('load', setPortfolioHeights);
  window.addEventListener('resize', setPortfolioHeights, { passive: true });

  /* ── Form submit (demo) ────────────────────────────────── */
  const form = document.querySelector('.contact-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const orig = btn.textContent;
      btn.textContent = 'Message Sent';
      btn.style.background = '#1affaa';
      setTimeout(() => {
        btn.textContent = orig;
        btn.style.background = '';
        form.reset();
      }, 3000);
    });
  }

})();
