const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const el = entry.target as HTMLElement;
    if (el.classList.contains('stagger')) {
      [...el.children].forEach((child, i) => ((child as HTMLElement).style.transitionDelay = `${i * 90}ms`));
    }
    el.classList.add('in');
    io.unobserve(el);
  });
}, { threshold: 0.14 });

document.querySelectorAll('.reveal,.stagger').forEach((el) => io.observe(el));
