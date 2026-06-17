const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * HTML-escape an arbitrary value so it cannot break out of text or attribute
 * context when injected into an email template. Nullish values render as ''.
 */
export const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);

/**
 * Render an HTML email template by replacing every `{{ key }}` placeholder with
 * the HTML-escaped value from `vars`. Prevents HTML/email injection (S3) from
 * unescaped user-submitted form data.
 */
export const renderTemplate = (
  template: string,
  vars: Record<string, unknown>
): string =>
  Object.entries(vars).reduce(
    (html, [key, value]) => html.split(`{{ ${key} }}`).join(escapeHtml(value)),
    template
  );
