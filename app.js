/* ============================================================
   TCCA Northeast — interface logic (vanilla JS, no dependencies)
   Ported from the original Design Component `componentDidMount`.
   Two behaviors: a scroll-triggered fade-and-rise reveal on
   [data-reveal] sections (prefers-reduced-motion and
   no-IntersectionObserver aware), and the small-screen nav
   toggle. Content stays visible if JS is disabled — the reveal
   only adds motion, and the nav collapse is gated behind the
   .no-js class removed in <head>.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initScrollReveals();
  initNavToggle();
});

function initNavToggle() {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!header || !toggle || !nav) return;

  const setOpen = (open) => {
    header.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };

  toggle.addEventListener('click', () => {
    setOpen(!header.classList.contains('nav-open'));
  });

  // Close after choosing a destination.
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  // Reset if the viewport grows past the collapse breakpoint.
  const wide = window.matchMedia('(min-width: 900px)');
  const onChange = (m) => { if (m.matches) setOpen(false); };
  if (wide.addEventListener) wide.addEventListener('change', onChange);
  else if (wide.addListener) wide.addListener(onChange);
}

function initScrollReveals() {
  const els = document.querySelectorAll('[data-reveal]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // No motion wanted (or not supported): make sure everything is shown.
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    return;
  }

  // Set the initial hidden state, then reveal on scroll into view.
  els.forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.willChange = 'opacity, transform';
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        const el = e.target;
        el.style.transition = 'opacity .7s cubic-bezier(0.4,0,0.2,1), transform .7s cubic-bezier(0.4,0,0.2,1)';
        el.style.opacity = '1';
        el.style.transform = 'none';
        io.unobserve(el);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  els.forEach((el) => io.observe(el));
}
