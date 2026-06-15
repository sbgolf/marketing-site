const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

function getScrollOffset() {
  const nav = document.getElementById('nav');
  return (nav?.getBoundingClientRect().height ?? 0) + 18;
}

function scrollToId(
  id: string,
  options: { updateHash?: boolean; replaceHash?: boolean; instant?: boolean } = {},
) {
  const target = document.getElementById(id);
  if (!target) return;

  (window as any).closeMenu?.();

  requestAnimationFrame(() => {
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - getScrollOffset());
    window.scrollTo({
      top,
      behavior: options.instant || prefersReducedMotion ? 'auto' : 'smooth',
    });

    if (options.updateHash) {
      const hash = `#${id}`;
      if (options.replaceHash) history.replaceState(null, '', hash);
      else if (window.location.hash !== hash) history.pushState(null, '', hash);
    }
  });
}

document.querySelectorAll<HTMLButtonElement>('[data-scroll]').forEach((el) => {
  el.addEventListener('click', (event) => {
    event.preventDefault();
    const id = el.dataset.scroll;
    if (id) scrollToId(id, { updateHash: true });
  });
});

document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (event) => {
    const href = anchor.getAttribute('href') || '';
    event.preventDefault();
    if (href.length > 1) scrollToId(href.slice(1), { updateHash: true });
  });
});

function restoreHashPosition() {
  const id = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (!id) return;

  // Browsers apply the initial hash jump before fonts/images and reveal styles fully settle.
  // Re-run the corrected offset scroll a few times so direct mobile links like /#audit
  // land on the actual section instead of above a blank transition gap.
  [0, 100, 350, 800, 1400].forEach((delay) => {
    window.setTimeout(() => {
      if (window.location.hash === `#${id}`) {
        scrollToId(id, { updateHash: true, replaceHash: true, instant: delay === 0 });
      }
    }, delay);
  });
}

window.addEventListener('load', restoreHashPosition);
window.addEventListener('hashchange', restoreHashPosition);

(window as any).scrollToId = scrollToId;
