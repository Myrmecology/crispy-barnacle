/**
 * UX LAB — Demo Site / main.js
 * ─────────────────────────────────────────────────────────────
 * Handles all interactive behavior on the Justin UX LAB demo site.
 * Runs on all three pages: Home, About, Contact.
 * tracker.js handles all the silent data capture separately.
 * ─────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  // ── Smooth scroll for any anchor links ──────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ── Nav scroll shadow ────────────────────────────────────────
  const nav = document.querySelector('.nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        nav.style.boxShadow = '0 4px 24px rgba(15,21,35,0.10)';
      } else {
        nav.style.boxShadow = 'none';
      }
    }, { passive: true });
  }

  // ── Animate elements into view on scroll ────────────────────
  const observerOptions = {
    threshold: 0.15,
    rootMargin: '0px 0px -40px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity    = '1';
        entry.target.style.transform  = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Apply to cards and sections
  document.querySelectorAll(
    '.feature-card, .value-card, .team-card, .hero__stats, .cta-banner'
  ).forEach(el => {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });

  // ── Active nav link highlight ────────────────────────────────
  const currentPath = window.location.pathname.split('/').pop();
  document.querySelectorAll('.nav__links a').forEach(link => {
    const linkPath = link.getAttribute('href').split('/').pop();
    if (linkPath === currentPath) {
      link.classList.add('active');
    }
  });

  // ── Contact form validation ──────────────────────────────────
  const submitBtn = document.querySelector('.form__submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const fname   = document.getElementById('fname');
      const email   = document.getElementById('email');
      const message = document.getElementById('message');
      const privacy = document.getElementById('privacy');

      // Simple visual validation
      let valid = true;

      [fname, email, message].forEach(field => {
        if (field && !field.value.trim()) {
          field.style.borderColor = '#ff3a6e';
          field.style.boxShadow   = '0 0 0 3px rgba(255,58,110,0.12)';
          valid = false;
          setTimeout(() => {
            field.style.borderColor = '';
            field.style.boxShadow   = '';
          }, 2000);
        }
      });

      if (privacy && !privacy.checked) {
        privacy.style.outline = '2px solid #ff3a6e';
        valid = false;
        setTimeout(() => { privacy.style.outline = ''; }, 2000);
      }

      if (valid) {
        // handleSubmit() is defined inline in contact.html
        if (typeof handleSubmit === 'function') handleSubmit();
      }
    });
  }

  // ── Subtle cursor trail effect ───────────────────────────────
  // Creates a small dot trail as the user moves their mouse
  // Makes mouse movement visible — great for heatmap demos
  let trailEnabled = true;
  const TRAIL_COLOR = 'rgba(79,70,229,0.25)';

  if (trailEnabled) {
    document.addEventListener('mousemove', (e) => {
      const dot = document.createElement('div');
      dot.style.cssText = `
        position: fixed;
        left: ${e.clientX}px;
        top: ${e.clientY}px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: ${TRAIL_COLOR};
        pointer-events: none;
        z-index: 9999;
        transform: translate(-50%, -50%);
        transition: opacity 0.6s ease;
      `;
      document.body.appendChild(dot);
      requestAnimationFrame(() => { dot.style.opacity = '0'; });
      setTimeout(() => dot.remove(), 600);
    });
  }

  console.debug('[Justin UX LAB] main.js loaded — UX LAB tracker active');

})();