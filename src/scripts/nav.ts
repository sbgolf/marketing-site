const nav = document.getElementById('nav');
const burger = document.getElementById('burger') as HTMLButtonElement | null;
const navLinks = document.getElementById('navLinks');

function closeMenu() {
  navLinks?.classList.remove('open');
  nav?.classList.remove('menu-open');
  document.body.classList.remove('no-scroll');
  burger?.setAttribute('aria-expanded', 'false');
}

function toggleMenu() {
  const isOpen = !navLinks?.classList.contains('open');
  navLinks?.classList.toggle('open', isOpen);
  nav?.classList.toggle('menu-open', isOpen);
  document.body.classList.toggle('no-scroll', isOpen);
  burger?.setAttribute('aria-expanded', String(isOpen));
}

addEventListener('scroll', () => nav?.classList.toggle('scrolled', scrollY > 40), { passive: true });
burger?.addEventListener('click', toggleMenu);
navLinks?.querySelectorAll('a,button').forEach((el) => el.addEventListener('click', closeMenu));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

(window as any).closeMenu = closeMenu;
