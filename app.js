/* ============================================================
   TCCA Northeast — interface logic (vanilla JS, no dependencies)
   Ported from the original Design Component `componentDidMount`.
   The single behavior is a scroll-triggered fade-and-rise reveal
   on [data-reveal] sections, with full prefers-reduced-motion and
   no-IntersectionObserver fallbacks. Content stays visible if JS
   is disabled (this script only adds motion, never hides content
   permanently).
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initScrollReveals();
});

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
