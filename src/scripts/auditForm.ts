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

const setMessage = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
  if (!msg) return;
  msg.textContent = text;
  msg.dataset.state = type;
};

form?.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!form.checkValidity()) {
    setMessage('Please fill in all required fields.', 'error');
    form.reportValidity();
    return;
  }

  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const formData = new FormData(form);
  const payload = {
    race_name: String(formData.get('raceName') || ''),
    current_url: String(formData.get('currentUrl') || ''),
    contact_name: String(formData.get('auditName') || ''),
    contact_email: String(formData.get('auditEmail') || ''),
    company_website: String(formData.get('companyWebsite') || ''),
    landing_page: window.location.href,
    referrer: document.referrer,
  };

  submitButton?.setAttribute('disabled', 'true');
  setMessage('Sending your request…', 'info');

  try {
    const response = await fetch('/.netlify/functions/submit-audit-request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null) as { message?: string; error?: string } | null;

    if (!response.ok || !result?.message) {
      throw new Error(result?.error || 'Submission failed.');
    }

    setMessage('Thanks — your private audit request was received. We’ll review it and follow up by email.', 'success');
    form.reset();
  } catch (error) {
    console.error(error);
    setMessage('Sorry, the request could not be sent. Please try again or email us directly.', 'error');
  } finally {
    submitButton?.removeAttribute('disabled');
  }
});
