import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedUrl = 'https://wzpaghnxlpfjojvuxplx.supabase.co';
const secretPath = process.env.REAL_AUTH_SECRET_FILE
  || path.join(os.homedir(), '.secrets', '77hk-staging-real-email-auth.env');

function readEnv(filePath) {
  const values = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function publicClient() {
  const env = readEnv(path.join(root, 'client', '.env'));
  if (env.VITE_SUPABASE_URL !== expectedUrl) throw new Error('client is not configured for staging');
  if (!env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) {
    throw new Error('missing staging publishable key');
  }
  return createClient(expectedUrl, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function serviceClient() {
  const serverEnv = readEnv(path.join(root, 'server', '.env'));
  if (serverEnv.SUPABASE_URL !== expectedUrl) throw new Error('server is not configured for staging');
  const secretEnv = readEnv(serverEnv.SUPABASE_SECRET_KEY_FILE);
  if (!secretEnv.SUPABASE_SECRET_KEY?.startsWith('sb_secret_')) {
    throw new Error('missing staging secret key');
  }
  return createClient(expectedUrl, secretEnv.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function findUser(service, email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 100) return null;
  }
  return null;
}

async function main() {
  const mode = process.argv[2];
  const secrets = readEnv(secretPath);
  const email = secrets.REAL_TEST_EMAIL;
  if (!email || !secrets.REAL_TEST_PASSWORD || !secrets.REAL_TEST_PASSWORD_NEW) {
    throw new Error('real-email test secret file is incomplete');
  }

  if (mode === 'signup') {
    const { data, error } = await publicClient().auth.signUp({
      email,
      password: secrets.REAL_TEST_PASSWORD,
      options: { emailRedirectTo: 'http://localhost:5173/auth/callback' },
    });
    if (error) throw error;
    if (!data.user) throw new Error('signup did not return a user');
    console.log(`SIGNUP_REQUESTED session_created=${Boolean(data.session)}`);
    return;
  }

  if (mode === 'status') {
    const user = await findUser(serviceClient(), email);
    console.log(`USER_EXISTS=${Boolean(user)} EMAIL_CONFIRMED=${Boolean(user?.email_confirmed_at)}`);
    return;
  }

  if (mode === 'login') {
    const password = process.argv[3] === 'new'
      ? secrets.REAL_TEST_PASSWORD_NEW
      : secrets.REAL_TEST_PASSWORD;
    const client = publicClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw error ?? new Error('login did not return a session');
    await client.auth.signOut();
    console.log(`LOGIN_OK password_variant=${process.argv[3] === 'new' ? 'new' : 'initial'}`);
    return;
  }

  if (mode === 'request-reset') {
    const { error } = await publicClient().auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:5173/reset-password',
    });
    if (error) throw error;
    console.log('PASSWORD_RESET_REQUESTED');
    return;
  }

  if (mode === 'browser-reset') {
    const service = serviceClient();
    const { data, error } = await service.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: 'http://127.0.0.1:5173/reset-password' },
    });
    if (error || !data.properties?.action_link) {
      throw error ?? new Error('recovery link was not generated');
    }
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await page.goto(data.properties.action_link, { waitUntil: 'domcontentloaded' });
      await page.waitForURL(/127\.0\.0\.1:5173\/reset-password/, { timeout: 15_000 });
      await page.locator('#reset-new-password').fill(secrets.REAL_TEST_PASSWORD_NEW);
      await page.locator('#reset-confirm-password').fill(secrets.REAL_TEST_PASSWORD_NEW);
      await page.getByRole('button', { name: '重置密码' }).click();
      await page.getByText('密码已重置', { exact: true }).waitFor({ timeout: 15_000 });
      await page.screenshot({
        path: path.join(
          root,
          'docs',
          'evidence',
          '2026-07-16',
          'staging-auth-rls',
          'screenshots',
          'password-reset-desktop-1440.png',
        ),
        fullPage: true,
      });
    } finally {
      await browser.close();
    }
    console.log('BROWSER_PASSWORD_RESET_OK');
    return;
  }

  if (mode === 'cleanup') {
    const service = serviceClient();
    const user = await findUser(service, email);
    if (user) {
      const { error } = await service.auth.admin.deleteUser(user.id);
      if (error) throw error;
    }
    console.log('REAL_EMAIL_TEST_USER_REMOVED');
    return;
  }

  throw new Error('mode must be signup, status, login, request-reset, browser-reset, or cleanup');
}

main().catch((error) => {
  console.error(`AUTH_TEST_FAILED ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
});
