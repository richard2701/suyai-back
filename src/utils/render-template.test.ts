import { describe, it, expect } from 'vitest';
import { escapeHtml, renderTemplate } from './render-template';

describe('escapeHtml', () => {
  it('escapes all HTML-significant characters', () => {
    expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;');
  });

  it('renders nullish values as an empty string', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('stringifies non-string values', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(0)).toBe('0');
  });
});

describe('renderTemplate', () => {
  it('substitutes placeholders with escaped values', () => {
    const out = renderTemplate('<p>{{ name }}</p>', { name: 'Ada' });
    expect(out).toBe('<p>Ada</p>');
  });

  it('neutralizes an HTML/script injection payload (S3)', () => {
    const out = renderTemplate('<p>{{ name }}</p>', {
      name: '<img src=x onerror=alert(1)>',
    });
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapes every occurrence of a repeated placeholder', () => {
    const out = renderTemplate('{{ name }} / {{ name }}', { name: '<b>' });
    expect(out).toBe('&lt;b&gt; / &lt;b&gt;');
  });

  it('replaces multiple distinct placeholders', () => {
    const out = renderTemplate('{{ name }} <{{ email }}>', {
      name: 'Ada',
      email: 'ada@example.com',
    });
    expect(out).toBe('Ada <ada@example.com>');
  });

  it('leaves placeholders without a matching var untouched', () => {
    const out = renderTemplate('{{ name }} {{ phone }}', { name: 'Ada' });
    expect(out).toBe('Ada {{ phone }}');
  });

  it('renders nullish vars as empty strings', () => {
    const out = renderTemplate('[{{ message }}]', { message: null });
    expect(out).toBe('[]');
  });
});
