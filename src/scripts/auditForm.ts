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
    banner.innerHTML = `
      <strong>Deposit received — here is what happens next.</strong>
      <span>Stripe confirms the payment securely, and StartLine will use your kickoff details to move the project from deposit to build-ready. Complete the intake form, gather the assets/access we need, and email support if anything looks unusual.</span>
      <span>The build timeline starts after complete intake details and usable assets are received.</span>
      <div class="checkout-status-actions">
        <a class="btn btn-accent" href="/intake/">Complete customer intake →</a>
        <a class="btn btn-ghost" href="/asset-checklist/">Review asset checklist</a>
        <a class="checkout-support-link" href="mailto:support@startlinesites.com">Email support</a>
      </div>
    `;
  } else {
    banner.innerHTML = `
      <strong>No problem — the first-year package deposit checkout was not completed.</strong>
      <span>Your audit request or package conversation can continue. Return to pricing when you are ready, or request a private audit/package recommendation before paying.</span>
      <div class="checkout-status-actions">
        <a class="btn btn-accent" href="/#pricing">Return to pricing</a>
        <a class="btn btn-ghost" href="/#audit">Request a private audit</a>
      </div>
    `;
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
  proposalRequired?: boolean;
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
    proposalRequired: true,
  },
};

const isPackageKey = (value: string): value is PackageKey => value in packages;

const selectPackage = (tier: PackageKey) => {
  const packageInfo = packages[tier];
  if (packageTier) packageTier.value = tier;
  if (selectedPackage && selectedPackageLabel) {
    selectedPackageLabel.textContent = packageInfo.proposalRequired
      ? `${packageInfo.name} (reviewed proposal required before any first-year package deposit)`
      : `${packageInfo.name} (${packageInfo.deposit} first-year package deposit)`;
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
    setMessage('Please complete the required race name, URL, name, and email fields so we can send the audit response.', 'error');
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
  setMessage('Sending your private audit request…', 'info');

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
        `<div class="payment-next"><strong>Thanks — your private audit request was received.</strong><span>We’ll review/respond within 2 business days with findings and the recommended next step.</span><a href="${checkoutUrl}" target="_blank" rel="noopener noreferrer">Pay ${selectedPackageInfo.name} first-year package deposit when ready →</a><small>No deposit is required for the audit response. If you choose to move forward, the deposit starts the one-time first-year race-cycle package.</small></div>`,
        'success',
        true,
      );
    } else if (selectedPackageInfo) {
      setMessage(
        `Thanks — your private audit request was received. We’ll review/respond within 2 business days with findings, recommended scope, and the next step. ${selectedPackageInfo.name} requires a reviewed proposal before any first-year package deposit.`,
        'success',
      );
    } else {
      setMessage('Thanks — your private audit request was received. We’ll review/respond within 2 business days by email with findings and a recommended next step.', 'success');
    }

    form.reset();
    if (selectedPackage) selectedPackage.hidden = true;
    document.querySelectorAll<HTMLElement>('[data-package-card]').forEach((card) => card.classList.remove('selected'));
  } catch (error) {
    console.error(error);
    setMessage('Sorry, the audit request could not be sent. Please try again or email support@startlinesites.com with your race name and best public link.', 'error');
  } finally {
    submitButton?.removeAttribute('disabled');
  }
});
