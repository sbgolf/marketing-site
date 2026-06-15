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
const packageTier = document.getElementById('packageTier') as HTMLInputElement | null;
const selectedPackage = document.getElementById('selectedPackage');
const selectedPackageLabel = document.getElementById('selectedPackageLabel');

const showCheckoutReturnMessage = () => {
  const params = new URLSearchParams(window.location.search);
  const depositState = params.get('deposit');
  if (depositState !== 'success' && depositState !== 'cancelled') return;

  const banner = document.createElement('div');
  banner.className = `checkout-status checkout-status-${depositState}`;
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');

  if (depositState === 'success') {
    banner.innerHTML = '<strong>Thanks — if your deposit completed, Stripe will confirm it securely.</strong><span>Watch your inbox for StartLine kickoff details. The build timeline starts after complete intake details and usable assets are received.</span>';
  } else {
    banner.innerHTML = '<strong>No problem — the deposit checkout was not completed.</strong><span>You can return to pricing or request a package recommendation before paying.</span>';
  }

  document.getElementById('main')?.prepend(banner);
  const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
  window.history.replaceState({}, document.title, cleanUrl);
};

showCheckoutReturnMessage();

type PackageKey = 'starter' | 'standard' | 'premium';

type PackageInfo = {
  name: string;
  deposit: string;
  url?: string;
};

const packages: Record<PackageKey, PackageInfo> = {
  starter: {
    name: 'Starter',
    deposit: '$750',
    url: 'https://buy.stripe.com/8x2bIU1Bs0ww3H50UJ9fW00',
  },
  standard: {
    name: 'Standard',
    deposit: '$1,250',
    url: 'https://buy.stripe.com/28EeV65RI3II3H5bzn9fW01',
  },
  premium: {
    name: 'Premium',
    deposit: '$2,250',
  },
};

const isPackageKey = (value: string): value is PackageKey => value in packages;

const selectPackage = (tier: PackageKey) => {
  const packageInfo = packages[tier];
  if (packageTier) packageTier.value = tier;
  if (selectedPackage && selectedPackageLabel) {
    selectedPackageLabel.textContent = `${packageInfo.name} (${packageInfo.deposit} deposit)`;
    selectedPackage.hidden = false;
  }
  document.querySelectorAll<HTMLElement>('[data-package-card]').forEach((card) => {
    card.classList.toggle('selected', card.dataset.packageCard === tier);
  });
};

document.querySelectorAll<HTMLElement>('[data-package-tier]').forEach((button) => {
  button.addEventListener('click', () => {
    const tier = button.dataset.packageTier || '';
    if (isPackageKey(tier)) selectPackage(tier);
  });
});

const setMessage = (content: string, type: 'success' | 'error' | 'info' = 'info', html = false) => {
  if (!msg) return;
  if (html) {
    msg.innerHTML = content;
  } else {
    msg.textContent = content;
  }
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
  const selectedTier = String(formData.get('packageTier') || '');
  const payload = {
    race_name: String(formData.get('raceName') || ''),
    current_url: String(formData.get('currentUrl') || ''),
    contact_name: String(formData.get('auditName') || ''),
    contact_email: String(formData.get('auditEmail') || ''),
    notes: String(formData.get('notes') || ''),
    company_website: String(formData.get('companyWebsite') || ''),
    package_tier: isPackageKey(selectedTier) ? selectedTier : '',
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
    const result = await response.json().catch(() => null) as { message?: string; error?: string; checkout_url?: string } | null;

    if (!response.ok || !result?.message) {
      throw new Error(result?.error || 'Submission failed.');
    }

    const selectedPackageInfo = isPackageKey(payload.package_tier) ? packages[payload.package_tier] : null;
    const checkoutUrl = result.checkout_url || selectedPackageInfo?.url;
    if (selectedPackageInfo && checkoutUrl) {
      setMessage(
        `<div class="payment-next"><strong>Thanks — your private audit request was received.</strong><span>Ready to start with ${selectedPackageInfo.name}? Pay the ${selectedPackageInfo.deposit} deposit when you're ready.</span><a href="${checkoutUrl}" target="_blank" rel="noopener noreferrer">Pay ${selectedPackageInfo.name} deposit →</a><small>We will still review your race site and follow up by email. The deposit starts the project.</small></div>`,
        'success',
        true,
      );
    } else if (selectedPackageInfo) {
      setMessage(
        `Thanks — your private audit request was received. ${selectedPackageInfo.name} requires a reviewed proposal before deposit, so we’ll follow up by email with the recommended scope and next step.`,
        'success',
      );
    } else {
      setMessage('Thanks — your private audit request was received. We’ll review it and follow up by email with a package recommendation.', 'success');
    }

    form.reset();
    if (selectedPackage) selectedPackage.hidden = true;
    document.querySelectorAll<HTMLElement>('[data-package-card]').forEach((card) => card.classList.remove('selected'));
  } catch (error) {
    console.error(error);
    setMessage('Sorry, the request could not be sent. Please try again or email us directly.', 'error');
  } finally {
    submitButton?.removeAttribute('disabled');
  }
});
