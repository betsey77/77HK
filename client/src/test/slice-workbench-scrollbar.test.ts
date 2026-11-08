import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('workbench scrollbar visual contract', () => {
  it('scopes a visible dark/light scrollbar to the workbench shell', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');
    const scoped = css.slice(css.indexOf('Workbench scrollbars'));

    expect(scoped).toContain('[data-testid="workbench-shell"]');
    expect(scoped).toContain('scrollbar-color:');
    expect(scoped).toContain('::-webkit-scrollbar-track');
    expect(scoped).toContain('::-webkit-scrollbar-thumb');
    expect(scoped).toContain('html.light');
    expect(scoped).toContain('forced-colors: active');
    expect(scoped).not.toMatch(/scrollbar-width:\s*none|display:\s*none|width:\s*0/);
  });
});
