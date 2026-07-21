import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { validateRecaptcha } from './recaptcha';

function mockAssessment(body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve(body),
    })
  );
}

describe('validateRecaptcha (form-contact)', () => {
  beforeEach(() => {
    vi.stubEnv('RECAPTCHA_API_KEY', 'test-api-key');
    vi.stubEnv('RECAPTCHA_PROJECT_ID', 'test-project');
    vi.stubEnv('RECAPTCHA_SECRET_KEY', 'test-site-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('accepts a token whose action matches the expected action and score passes', async () => {
    mockAssessment({
      riskAnalysis: { score: 0.9 },
      tokenProperties: { valid: true, action: 'contact_form' },
    });

    await expect(validateRecaptcha('token', 'contact_form')).resolves.toBe(true);
  });

  it('rejects a token whose action does not match, even with a valid high score', async () => {
    mockAssessment({
      riskAnalysis: { score: 0.9 },
      tokenProperties: { valid: true, action: 'tour_reservation' },
    });

    await expect(validateRecaptcha('token', 'contact_form')).resolves.toBe(false);
  });

  it('rejects when the score is below threshold, regardless of action match', async () => {
    mockAssessment({
      riskAnalysis: { score: 0.1 },
      tokenProperties: { valid: true, action: 'contact_form' },
    });

    await expect(validateRecaptcha('token', 'contact_form')).resolves.toBe(false);
  });

  it('rejects when tokenProperties.valid is false', async () => {
    mockAssessment({
      riskAnalysis: { score: 0.9 },
      tokenProperties: { valid: false, action: 'contact_form' },
    });

    await expect(validateRecaptcha('token', 'contact_form')).resolves.toBe(false);
  });
});
