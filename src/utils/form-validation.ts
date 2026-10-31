import { GraphQLError } from 'graphql';

/**
 * Server-side validation for public form submissions. The submitter confirmation email echoes
 * some of these fields, so they are constrained to stop the form being used as a phishing relay
 * (links, markup or long free text delivered from our domain to an arbitrary address).
 */

// Matches explicit schemes, `www.` and host-like tokens such as `evil.com` or `bit.ly/x`.
const URL_PATTERN = /https?:|www\.|[\p{L}\d-]\.[a-z]{2,}\b/iu;
const MARKUP_PATTERN = /[<>]/;
const PHONE_PATTERN = /^[+\d\s()-]{6,20}$/;

interface FieldRule {
  maxLength: number;
  noUrls?: boolean;
  noMarkup?: boolean;
  pattern?: RegExp;
}

const PERSON_NAME: FieldRule = { maxLength: 60, noUrls: true, noMarkup: true };
const CATALOG_TEXT: FieldRule = { maxLength: 120, noUrls: true, noMarkup: true };

export const FORM_FIELD_RULES: Readonly<Record<string, FieldRule>> = {
  name: PERSON_NAME,
  lastname: PERSON_NAME,
  email: { maxLength: 254 },
  phone: { maxLength: 20, pattern: PHONE_PATTERN },
  message: { maxLength: 2000 },
  tourName: CATALOG_TEXT,
  destination: CATALOG_TEXT,
};

export interface FieldIssue {
  field: string;
  reason: 'too_long' | 'contains_url' | 'contains_markup' | 'invalid_format';
}

/**
 * Returns a copy with every string field trimmed, plus any rule
 * violations found. Non-string values and fields without a rule are passed through unchanged.
 */
export const sanitizeFormInput = <T extends Record<string, unknown>>(
  input: T
): { data: T; issues: FieldIssue[] } => {
  const data = { ...input };
  const issues: FieldIssue[] = [];

  for (const [field, raw] of Object.entries(input)) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim();
    (data as Record<string, unknown>)[field] = value;

    const rule = FORM_FIELD_RULES[field];
    if (!rule || value === '') continue;

    if (value.length > rule.maxLength) issues.push({ field, reason: 'too_long' });
    else if (rule.noMarkup && MARKUP_PATTERN.test(value)) issues.push({ field, reason: 'contains_markup' });
    else if (rule.noUrls && URL_PATTERN.test(value)) issues.push({ field, reason: 'contains_url' });
    else if (rule.pattern && !rule.pattern.test(value)) issues.push({ field, reason: 'invalid_format' });
  }

  return { data, issues };
};

/** Validates and trims the input, throwing a BAD_USER_INPUT GraphQL error on any violation. */
export const assertValidFormInput = <T extends Record<string, unknown>>(input: T): T => {
  const { data, issues } = sanitizeFormInput(input);
  if (issues.length > 0) {
    // GraphQLError passes through plugin-graphql's formatError unchanged; a @strapi/utils
    // ValidationError would not, because the plugin ships its own @strapi/utils copy and the
    // instanceof check there fails, turning it into a generic 500.
    throw new GraphQLError('Invalid form input.', {
      extensions: { code: 'BAD_USER_INPUT', fields: issues },
    });
  }
  return data;
};
