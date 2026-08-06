import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const clientRoot = process.cwd();
const repositoryRoot = path.resolve(clientRoot, '..');

const productionMarketingAssets = [
  {
    relativePath: 'public/brand/team-collab-preview.jpg',
    repositoryPath: 'client/public/brand/team-collab-preview.jpg',
    sha256: 'be0a5d1ee8538ef799505deb9ca52d21158a7fce6ebc33668770cb57ed4ba837',
  },
  {
    relativePath: 'public/brand/whiteboard_exported_image.png',
    repositoryPath: 'client/public/brand/whiteboard_exported_image.png',
    sha256: 'd3d5f1feb2020e08e0652ac61ac454d4979b4b32717018fe4b2a2f3aa2c0a4e5',
  },
] as const;

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

  it('keeps production marketing assets tracked with their accepted bytes', () => {
    for (const asset of productionMarketingAssets) {
      const assetPath = path.resolve(clientRoot, asset.relativePath);

      expect(existsSync(assetPath), asset.relativePath).toBe(true);
      expect(
        execFileSync(
          'git',
          ['ls-files', '--error-unmatch', '--', asset.repositoryPath],
          { cwd: repositoryRoot, encoding: 'utf8' },
        ).trim(),
      ).toBe(asset.repositoryPath);
      expect(
        createHash('sha256').update(readFileSync(assetPath)).digest('hex'),
      ).toBe(asset.sha256);
    }
  });
});
