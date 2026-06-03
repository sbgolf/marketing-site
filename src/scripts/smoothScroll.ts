function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  (window as any).closeMenu?.();
}

document.querySelectorAll<HTMLElement>('[data-scroll]').forEach((el) => {
  el.addEventListener('click', (event) => {
    event.preventDefault();
    const id = el.dataset.scroll;
    if (id) scrollToId(id);
  });
});

document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (event) => {
    const href = anchor.getAttribute('href') || '';
    event.preventDefault();
    if (href.length > 1) scrollToId(href.slice(1));
  });
});

(window as any).scrollToId = scrollToId;
