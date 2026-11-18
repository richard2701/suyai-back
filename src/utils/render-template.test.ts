import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
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

describe('email templates footer', () => {
  const templatesDir = path.resolve(__dirname, '../../config/email/templates');
  const templateFiles = readdirSync(templatesDir).filter((file) => file.endsWith('.html'));

  it.each(templateFiles)('%s renders the copyright year exactly once', (file) => {
    const template = readFileSync(path.join(templatesDir, file), 'utf8');
    const out = renderTemplate(template, { copyYear: '2031' });
    expect(out).toContain('&copy; 2031 Suyai Tours.');
    // A hardcoded year next to the dynamic one would render "2031 2025".
    expect(out).not.toMatch(/&copy;\s*\d{4}\s+\d{4}/);
  });
});
