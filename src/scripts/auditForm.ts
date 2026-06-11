document.querySelectorAll<HTMLButtonElement>('.faq-q').forEach((q) => {
  q.addEventListener('click', () => {
    const item = q.parentElement;
    const answer = item?.querySelector<HTMLElement>('.faq-a');
    const open = item?.classList.contains('open');
    document.querySelectorAll<HTMLElement>('.faq-item').forEach((i) => {
      i.classList.remove('open');
      const a = i.querySelector<HTMLElement>('.faq-a');
      if (a) a.style.maxHeight = '';
    });
    if (!open && item && answer) {
      item.classList.add('open');
      answer.style.maxHeight = `${answer.scrollHeight}px`;
    }
  });
});

const form = document.getElementById('auditForm') as HTMLFormElement | null;
const msg = document.getElementById('formMsg');
form?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.checkValidity()) {
    msg!.textContent = 'Please fill in all fields.';
    return;
  }
  msg!.textContent = 'Demo only — this request was not sent. Connect a form endpoint before publishing this CTA live.';
  form.reset();
});
