import { buildDuplicateFilters, buildMockupOutreachPayload, clean, parseEmailList } from './mockup-outreach-log.mjs';
import {
  assertBrandedMockupOutreachHtml,
  renderPrivateMockupOutreachEmail,
  validateMockupOutreachSend,
} from './mockup-outreach-send-gate.mjs';

const APPROVED_QA_STATUSES = new Set(['passed', 'pass', 'approved', 'ready']);
const APPROVED_AUDITOR_STATUSES = new Set(['passed', 'pass', 'approved', 'ready']);
const APPROVED_OWNER_STATUSES = new Set(['approved', 'approved_to_send', 'send_approved']);

const normalizeObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const normalizeStatus = (value) => clean(value, 120).toLowerCase();

const firstString = (...values) => values.map((value) => clean(value, 1000)).find(Boolean) || '';

export const extractProspectEmails = (prospect = {}) => {
  const emails = [];
  const add = (value) => {
    for (const email of parseEmailList(value)) {
      if (!emails.includes(email)) emails.push(email);
    }
  };

  add(prospect.contact_email);
  add(prospect.email);
  add(prospect.owner_email);

  const contactSources = Array.isArray(prospect.contact_sources) ? prospect.contact_sources : [];
  for (const source of contactSources) {
    if (typeof source === 'string') add(source);
    else if (source && typeof source === 'object') add(source.email || source.value || source.address);
  }

  return emails;
};

export const validateGenerationJobSendReadiness = (generationJob = {}, options = {}) => {
  const errors = [];
  const job = normalizeObject(generationJob);
  const sourceBundle = normalizeObject(job.source_bundle);

  if (!firstString(job.mockup_url)) errors.push('generation job mockup_url is required.');
  if (!firstString(job.template, job.mockup_template)) errors.push('generation job template is required.');
  if (!firstString(sourceBundle.race_name, job.race_name)) errors.push('generation job source_bundle.race_name is required.');
  if (firstString(job.outreach_id)) errors.push('generation job already has outreach_id; duplicate send blocked.');

  const qaStatus = normalizeStatus(job.qa_status);
  if (!APPROVED_QA_STATUSES.has(qaStatus)) errors.push(`generation job qa_status must be passed/approved before outreach; received ${qaStatus || 'blank'}.`);

  const siteAuditorStatus = normalizeStatus(job.site_auditor_status);
  if (!APPROVED_AUDITOR_STATUSES.has(siteAuditorStatus)) errors.push(`generation job site_auditor_status must be passed/approved before outreach; received ${siteAuditorStatus || 'blank'}.`);

  const ownerApprovalStatus = normalizeStatus(job.owner_approval_status);
  if (!APPROVED_OWNER_STATUSES.has(ownerApprovalStatus)) errors.push(`generation job owner_approval_status must be approved before outreach; received ${ownerApprovalStatus || 'blank'}.`);

  if (options.requireOwnerApprovedFlag !== false && options.ownerApprovedSend !== true) {
    errors.push('explicit --owner-approved-send is required for this race-director send.');
  }

  return errors;
};

export const buildOutreachInputFromGenerationJob = ({ generationJob = {}, prospect = {}, overrides = {} } = {}) => {
  const job = normalizeObject(generationJob);
  const sourceBundle = normalizeObject(job.source_bundle);
  const metadata = normalizeObject(job.metadata);
  const prospectMetadata = normalizeObject(prospect.metadata);

  const raceName = firstString(overrides.raceName, sourceBundle.race_name, prospect.race_name, metadata.config_identity_name);
  const mockupUrl = firstString(overrides.mockupUrl, job.mockup_url);
  const mockupTemplate = firstString(overrides.mockupTemplate, job.template, job.mockup_template);
  const registrationUrl = firstString(overrides.registrationUrl, sourceBundle.registration_url, prospect.registration_url);
  const officialUrl = firstString(overrides.officialUrl, sourceBundle.official_url, prospect.official_url);
  const sourceUrl = firstString(sourceBundle.source_url, prospect.source_url);
  const toEmails = parseEmailList(overrides.toEmails).length ? parseEmailList(overrides.toEmails) : extractProspectEmails(prospect);
  const subject = firstString(overrides.subject) || `A private website mockup for ${raceName || 'your race'}`;
  const detail = firstString(overrides.detail) || `I put together a private StartLine Sites preview for ${raceName || 'your race'} using public race information. The goal is to show how the race details could be organized into a clearer runner-facing page while keeping registration on the race's current registration platform.`;

  return {
    raceName,
    raceSlug: firstString(overrides.raceSlug, prospect.race_slug, sourceBundle.race_slug),
    raceCity: firstString(overrides.raceCity, prospect.race_city),
    raceState: firstString(overrides.raceState, prospect.race_state),
    officialUrl,
    registrationUrl,
    registrationPlatform: firstString(overrides.registrationPlatform, sourceBundle.registration_platform, prospect.registration_platform),
    registrationRaceId: firstString(overrides.registrationRaceId, sourceBundle.registration_race_id, prospect.registration_race_id),
    mockupUrl,
    mockupToken: firstString(overrides.mockupToken, job.mockup_token),
    mockupTemplate,
    mockupVerifiedAt: firstString(overrides.mockupVerifiedAt, job.qa_completed_at, job.updated_at),
    subject,
    toEmails,
    ccEmails: overrides.ccEmails,
    bccEmails: overrides.bccEmails,
    contactSources: Array.isArray(prospect.contact_sources) ? prospect.contact_sources : [],
    owner: firstString(overrides.owner, prospect.owner, prospectMetadata.owner),
    notes: firstString(overrides.notes) || 'Prepared from approved race_mockup_generation_jobs handoff; send still requires explicit Steve approval.',
    detail,
    metadata: {
      generation_job_id: job.id || null,
      prospect_id: job.prospect_id || prospect.id || null,
      source_url: sourceUrl || null,
      generated_config_path: job.config_path || null,
      race_template_pr_url: job.pull_request_url || null,
      deploy_preview_url: job.deploy_preview_url || null,
      qa_status: job.qa_status || null,
      site_auditor_status: job.site_auditor_status || null,
      owner_approval_status: job.owner_approval_status || null,
      prepared_by: 'scripts/prepare-mockup-outreach-from-job.mjs',
    },
  };
};

export const buildPreparedMockupOutreach = ({ generationJob = {}, prospect = {}, overrides = {}, ownerApprovedSend = false } = {}) => {
  const readinessErrors = validateGenerationJobSendReadiness(generationJob, { ownerApprovedSend });
  const input = buildOutreachInputFromGenerationJob({ generationJob, prospect, overrides });
  const sendErrors = validateMockupOutreachSend(input);
  const email = renderPrivateMockupOutreachEmail({
    raceName: input.raceName,
    contactName: overrides.contactName,
    mockupUrl: input.mockupUrl,
    subject: input.subject,
    detail: input.detail,
  });
  const htmlErrors = assertBrandedMockupOutreachHtml({ html: email.html, mockupUrl: input.mockupUrl });
  const payload = buildMockupOutreachPayload({ ...input, subject: email.subject, outreachStatus: overrides.outreachStatus || 'approved_ready_to_send' });
  const errors = [...readinessErrors, ...sendErrors, ...htmlErrors];

  return {
    ok: errors.length === 0,
    errors,
    email: {
      subject: email.subject,
      text: email.text,
      html_checks: htmlErrors.length ? htmlErrors : 'passed',
    },
    payload,
    duplicate_filters: buildDuplicateFilters(payload),
    next: 'If Steve approves customer delivery, run the existing send gate or contact-form workflow and record the accepted send in race_mockup_outreach.',
  };
};
