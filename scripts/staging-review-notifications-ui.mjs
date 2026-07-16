import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedUrl = 'https://wzpaghnxlpfjojvuxplx.supabase.co';
const appOrigin = 'http://127.0.0.1:5186';
const apiOrigin = 'http://127.0.0.1:3004';
const apiBase = `${apiOrigin}/api`;
const realAuthSecretPath = process.env.REAL_AUTH_SECRET_FILE
  || path.join(os.homedir(), '.secrets', '77hk-staging-real-email-auth.env');
const screenshotDir = path.join(
  root,
  'docs',
  'evidence',
  '2026-07-16',
  'staging-auth-rls',
  'screenshots',
);

function readEnv(filePath) {
  const values = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pass(message) {
  console.log(`PASS ${message}`);
}

async function expectData(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function findUser(service, email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  return null;
}

async function waitForUrl(url, child, label) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`${label} exited before becoming ready`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry until the bounded timeout expires.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not become ready`);
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function login(page, email, password, nextPath) {
  const loginTarget = nextPath === '/admin' ? '/app' : nextPath;
  await page.goto(`${appOrigin}/login?next=${encodeURIComponent(loginTarget)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL((url) => url.origin === appOrigin && url.pathname === loginTarget, {
    timeout: 20_000,
    waitUntil: 'domcontentloaded',
  });
  if (nextPath !== loginTarget) {
    await page.goto(`${appOrigin}${nextPath}`, { waitUntil: 'domcontentloaded' });
  }
}

async function maskEmails(page) {
  await page.evaluate(() => {
    const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.textContent && email.test(node.textContent)) {
        node.textContent = node.textContent.replace(email, '[email hidden]');
      }
      email.lastIndex = 0;
      node = walker.nextNode();
    }
  });
}

async function screenshot(page, name) {
  await maskEmails(page);
  await page.screenshot({ path: path.join(screenshotDir, name), fullPage: true });
}

async function assertNoHorizontalOverflow(page) {
  const hasOverflow = await page.evaluate(() => (
    document.documentElement.scrollWidth > window.innerWidth + 1
  ));
  assert(!hasOverflow, 'page has document-level horizontal overflow');
}

async function api(pathname, token, options = {}) {
  const response = await fetch(`${apiBase}${pathname}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  return {
    status: response.status,
    body: await response.json().catch(() => null),
  };
}

async function main() {
  const clientEnv = readEnv(path.join(root, 'client', '.env'));
  const serverEnv = readEnv(path.join(root, 'server', '.env'));
  const realSecrets = readEnv(realAuthSecretPath);
  assert(clientEnv.VITE_SUPABASE_URL === expectedUrl, 'client is not configured for staging');
  assert(serverEnv.SUPABASE_URL === expectedUrl, 'server is not configured for staging');
  assert(clientEnv.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_'), 'missing publishable key');
  assert(realSecrets.REAL_TEST_EMAIL && realSecrets.REAL_TEST_PASSWORD_NEW, 'real-email secret is incomplete');

  const serviceSecret = readEnv(serverEnv.SUPABASE_SECRET_KEY_FILE).SUPABASE_SECRET_KEY;
  assert(serviceSecret?.startsWith('sb_secret_'), 'missing staging secret key');
  const service = createClient(expectedUrl, serviceSecret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const publicOptions = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  };
  const userClient = createClient(expectedUrl, clientEnv.VITE_SUPABASE_PUBLISHABLE_KEY, publicOptions);
  const adminClient = createClient(expectedUrl, clientEnv.VITE_SUPABASE_PUBLISHABLE_KEY, publicOptions);
  const runId = `${Date.now()}-${randomBytes(3).toString('hex')}`;
  const group = 'group-a';
  const adminEmail = `codex-staging-ui-${runId}@example.invalid`;
  const adminPassword = `T7!${randomBytes(24).toString('hex')}`;
  const favoriteClientId = `staging-ui-${runId}`;
  const brandName = '77 Staging 通知验收';
  const content = '今晚八点，港味新品准时登场。';
  let user;
  let originalReviewGroup = null;
  let adminId;
  let favoriteId;
  let server;
  let vite;
  let browser;

  fs.mkdirSync(screenshotDir, { recursive: true });

  try {
    user = await findUser(service, realSecrets.REAL_TEST_EMAIL);
    assert(user?.email_confirmed_at, 'real-email user is missing or unconfirmed');
    const profile = await expectData(
      await service.from('profiles').select('review_group').eq('id', user.id).single(),
      'load real user profile',
    );
    originalReviewGroup = profile.review_group;

    const userLogin = await userClient.auth.signInWithPassword({
      email: realSecrets.REAL_TEST_EMAIL,
      password: realSecrets.REAL_TEST_PASSWORD_NEW,
    });
    assert(!userLogin.error && userLogin.data.session, 'real user login failed');

    const createdAdmin = await service.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { display_name: 'Staging UI Admin' },
    });
    if (createdAdmin.error || !createdAdmin.data.user) {
      throw createdAdmin.error ?? new Error('temporary admin creation failed');
    }
    adminId = createdAdmin.data.user.id;
    await expectData(
      await service.from('profiles').update({ review_group: group }).in('id', [user.id, adminId]).select('id'),
      'assign review group',
    );
    await expectData(
      await service.from('user_roles').insert({ user_id: adminId, role: 'admin' }).select('id').single(),
      'assign admin role',
    );
    const adminLogin = await adminClient.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
    assert(!adminLogin.error && adminLogin.data.session, 'temporary admin login failed');

    const favorite = await expectData(
      await userClient.from('favorites').insert({
        owner_id: user.id,
        client_id: favoriteClientId,
        variant_key: 'standardHK',
        content,
        source: 'staging notification UI acceptance',
        settings: {
          brandName,
          productName: '通知验收文案',
          copyType: 'social',
          publishPlatform: 'IG',
        },
        notes: 'staging notification acceptance',
        reason_tags: ['brand_fit'],
        is_user_authored: true,
        review_requested: true,
      }).select('id,review_requested_at').single(),
      'seed pending favorite',
    );
    assert(favorite.review_requested_at, 'favorite did not enter the pending queue');
    favoriteId = favorite.id;
    pass('staging user, temporary admin, and pending favorite prepared');

    const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    server = spawn(process.execPath, [tsxCli, path.join(root, 'server', 'src', 'index.ts')], {
      cwd: path.join(root, 'server'),
      env: { ...process.env, PORT: '3004', ALLOWED_ORIGINS: appOrigin },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    vite = spawn(process.execPath, [
      path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
      '--host', '127.0.0.1', '--port', '5186', '--strictPort',
    ], {
      cwd: path.join(root, 'client'),
      env: {
        ...process.env,
        VITE_API_BASE_URL: apiOrigin,
        VITE_SUPABASE_URL: expectedUrl,
        VITE_SUPABASE_PUBLISHABLE_KEY: clientEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    await Promise.all([
      waitForUrl(`${apiBase}/health`, server, 'API server'),
      waitForUrl(appOrigin, vite, 'Vite server'),
    ]);
    browser = await chromium.launch({ headless: true });

    const adminDesktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminDesktopPage = await adminDesktop.newPage();
    await login(adminDesktopPage, adminEmail, adminPassword, '/admin');
    const desktopReminder = adminDesktopPage.getByTestId('admin-page-review-reminder');
    await expect(desktopReminder).toContainText('1 条文案待审核', { timeout: 20_000 });
    await screenshot(adminDesktopPage, 'admin-pending-reminder-desktop-1440-staging.png');
    await desktopReminder.getByRole('button', { name: '稍后审核' }).click();
    await expect(desktopReminder).toHaveCount(0);
    await adminDesktopPage.reload({ waitUntil: 'domcontentloaded' });
    await expect(adminDesktopPage.getByTestId('admin-page-review-reminder')).toHaveCount(0);
    await adminDesktop.close();
    pass('admin desktop reminder appears once and supports later review');

    const adminMobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const adminMobilePage = await adminMobile.newPage();
    await login(adminMobilePage, adminEmail, adminPassword, '/admin');
    const mobileReminder = adminMobilePage.getByTestId('admin-page-review-reminder');
    await expect(mobileReminder).toContainText('1 条文案待审核', { timeout: 20_000 });
    await mobileReminder.getByRole('button', { name: '立刻审核' }).click();
    await expect(adminMobilePage.getByRole('button', { name: '只看待审核' })).toContainText('1');
    const pendingRow = adminMobilePage.getByTestId('admin-pending-row');
    await expect(pendingRow).toBeVisible();
    await assertNoHorizontalOverflow(adminMobilePage);
    await screenshot(adminMobilePage, 'admin-pending-queue-mobile-390-staging.png');
    await pendingRow.getByRole('button', { name: '查看收藏详情' }).click();
    await expect(adminMobilePage.getByTestId('favorite-review-dialog')).toBeVisible();
    await adminMobilePage.getByTestId('review-status-adopted').click();
    await adminMobilePage.getByTestId('review-save-btn').click();
    await expect(adminMobilePage.getByTestId('review-success')).toHaveText('审核已保存');
    await screenshot(adminMobilePage, 'admin-review-saved-mobile-390-staging.png');
    await adminMobile.close();
    pass('admin mobile reminder opens the pending queue and saves an adopted review');

    const userDesktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const userDesktopPage = await userDesktop.newPage();
    await login(userDesktopPage, realSecrets.REAL_TEST_EMAIL, realSecrets.REAL_TEST_PASSWORD_NEW, '/app');
    const adoptedDialog = userDesktopPage.getByRole('dialog', { name: '文案审核结果' });
    await expect(adoptedDialog).toContainText(`你的「${brandName}」文案已通过审核，请立即查看`, { timeout: 20_000 });
    await screenshot(userDesktopPage, 'user-review-adopted-desktop-1440-staging.png');
    await adoptedDialog.getByRole('button', { name: '立即查看' }).click();
    await expect(userDesktopPage.getByRole('heading', { name: '文案收藏库' })).toBeVisible();
    const focusedFavorite = userDesktopPage.getByTestId(`bookmark-card-${favoriteClientId}`);
    await expect(focusedFavorite).toHaveAttribute('data-focused', 'true');
    await expect(focusedFavorite).toContainText(content);
    await screenshot(userDesktopPage, 'user-review-immediate-favorite-desktop-1440-staging.png');
    await userDesktop.close();
    pass('user adopted-review reminder opens and focuses the reviewed favorite');

    const revisedContent = '今晚九点，港味新品更新后再登场。';
    const revised = await expectData(
      await userClient.from('favorites').update({ content: revisedContent }).eq('id', favoriteId).select('content_revision').single(),
      'revise favorite for second review cycle',
    );
    assert(revised.content_revision === 2, 'favorite revision did not increment');
    const changesRequested = await api(
      `/admin/favorites/${favoriteId}/review`,
      adminLogin.data.session.access_token,
      {
        method: 'PUT',
        body: JSON.stringify({
          status: 'changes_requested',
          note: '请把开场写得更直接。',
          annotations: [],
        }),
      },
    );
    assert(changesRequested.status === 200, `changes-requested review returned ${changesRequested.status}`);

    const userMobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const userMobilePage = await userMobile.newPage();
    await login(userMobilePage, realSecrets.REAL_TEST_EMAIL, realSecrets.REAL_TEST_PASSWORD_NEW, '/app');
    const changesDialog = userMobilePage.getByRole('dialog', { name: '文案审核结果' });
    await expect(changesDialog).toContainText(`你的「${brandName}」文案未通过审核，请立即查看`, { timeout: 20_000 });
    await expect(changesDialog).toContainText('请把开场写得更直接。');
    const box = await changesDialog.boundingBox();
    assert(box && box.x >= 0 && box.x + box.width <= 391, 'mobile review dialog exceeds the viewport');
    await assertNoHorizontalOverflow(userMobilePage);
    await screenshot(userMobilePage, 'user-review-changes-mobile-390-staging.png');
    await changesDialog.getByRole('button', { name: '立即查看' }).click();
    const mobileFocused = userMobilePage.getByTestId(`bookmark-card-${favoriteClientId}`);
    await expect(mobileFocused).toHaveAttribute('data-focused', 'true');
    await expect(mobileFocused).toContainText(revisedContent);
    await screenshot(userMobilePage, 'user-review-immediate-favorite-mobile-390-staging.png');
    await userMobile.close();
    pass('user changes-requested reminder is mobile-safe and opens the revised favorite');
  } finally {
    await browser?.close().catch(() => undefined);
    await stopProcess(vite);
    await stopProcess(server);
    await userClient.auth.signOut().catch(() => undefined);
    await adminClient.auth.signOut().catch(() => undefined);

    if (favoriteId) {
      await service.from('favorite_admin_reviews').delete().eq('favorite_id', favoriteId);
      await service.from('favorites').delete().eq('id', favoriteId);
    }
    if (adminId) {
      await service.from('audit_log').delete().eq('actor', adminId);
      const { error } = await service.auth.admin.deleteUser(adminId);
      if (error) console.error('CLEANUP_ERROR temporary admin');
    }
    if (user) {
      await service.from('profiles').update({ review_group: originalReviewGroup }).eq('id', user.id);
    }
    console.log('CLEANUP temporary admin and notification acceptance data removed');
  }
}

main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : 'unknown notification UI error'}`);
  process.exitCode = 1;
});
