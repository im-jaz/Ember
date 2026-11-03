import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('static build inputs and JSON Server seed', () => {
  it('includes the static pages and external module scripts', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toContain('<main id="main">');
    expect(html).toContain('type="module" src="/app.js"');
    expect(html).not.toMatch(/<script>(?!\s*<\/script>)/i);
  });

  it('seeds a featured menu and persistent order collection', async () => {
    const data = JSON.parse(await readFile(new URL('../db.json', import.meta.url), 'utf8'));
    expect(data['menu-items'].some((item) => item.featured)).toBe(true);
    expect(Array.isArray(data.orders)).toBe(true);
  });
});
