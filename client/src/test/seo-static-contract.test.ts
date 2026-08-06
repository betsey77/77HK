import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const clientRoot = process.cwd();

describe('public SEO discovery contract', () => {
  it('serves crawler rules that point to the canonical sitemap', () => {
    const robotsPath = path.resolve(clientRoot, 'public/robots.txt');

    expect(existsSync(robotsPath)).toBe(true);

    const robots = readFileSync(robotsPath, 'utf8');
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Sitemap: https://77hk.net/sitemap.xml');
  });

  it('publishes a valid sitemap containing the canonical public homepage', () => {
    const sitemapPath = path.resolve(clientRoot, 'public/sitemap.xml');

    expect(existsSync(sitemapPath)).toBe(true);

    const sitemap = readFileSync(sitemapPath, 'utf8');
    const document = new DOMParser().parseFromString(sitemap, 'application/xml');
    expect(document.querySelector('parsererror')).toBeNull();
    expect(
      [...document.querySelectorAll('url > loc')].map((node) => node.textContent),
    ).toEqual(['https://77hk.net/']);
  });

  it('declares the production homepage as canonical', () => {
    const html = readFileSync(path.resolve(clientRoot, 'index.html'), 'utf8');
    const document = new DOMParser().parseFromString(html, 'text/html');

    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe('https://77hk.net/');
  });
});
