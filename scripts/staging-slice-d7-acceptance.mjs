import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedRef = 'wzpaghnxlpfjojvuxplx';
const expectedUrl = `https://${expectedRef}.supabase.co`;
const apiBase = 'http://127.0.0.1:3004/api';
const testPrefix = 'codex-staging-d7-';
const modelRequestId = randomUUID();

function readEnvFile(filePath) {
  const values = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pass(id, message) {
  console.log(`PASS ${id} ${message}`);
}

async function expectNoError(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

function hkDate(offsetDays = 0) {
  const shifted = new Date(Date.now() + (8 * 60 * 60 * 1000));
  shifted.setUTCDate(shifted.getUTCDate() + offsetDays);
  return shifted.toISOString().slice(0, 10);
}

async function api(pathname, token, options = {}) {
  const response = await fetch(`${apiBase}${pathname}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  return { status: response.status, body };
}

async function waitForServer(child) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) throw new Error('staging API server exited before becoming ready');
    try {
      const response = await fetch(`${apiBase}/health`);
      if (response.ok) return;
    } catch {
      // Keep polling until the bounded timeout below.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('staging API server did not become ready');
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function removeStaleUsers(service) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`failed to inspect staging users: ${error.message}`);
    const stale = data.users.filter((user) => user.email?.startsWith(testPrefix));
    for (const user of stale) {
      const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
      if (deleteError) throw new Error(`failed to remove stale staging user: ${deleteError.message}`);
    }
    if (data.users.length < 100) break;
  }
}

async function createAccount(service, publishableKey, runId, label) {
  const email = `${testPrefix}${runId}-${label}@example.invalid`;
  const password = `T7!${randomBytes(24).toString('hex')}`;
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `D7 ${label}` },
  });
  if (created.error || !created.data.user) {
    throw new Error(`failed to create ${label}: ${created.error?.message ?? 'unknown error'}`);
  }

  const browser = createClient(expectedUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const login = await browser.auth.signInWithPassword({ email, password });
  if (login.error || !login.data.session) throw new Error(`failed to sign in ${label}`);
  return {
    label,
    id: created.data.user.id,
    client: browser,
    token: login.data.session.access_token,
  };
}

async function seedSixDays(service, userId) {
  const streakStartedOn = hkDate(-6);
  const rows = Array.from({ length: 6 }, (_, index) => ({
    user_id: userId,
    checkin_date_hk: hkDate(index - 6),
    streak_count: index + 1,
    streak_started_on: streakStartedOn,
  }));
  await expectNoError(await service.from('daily_checkins').insert(rows), 'seed six check-in days');
}

async function main() {
  const clientEnv = readEnvFile(path.join(root, 'client', '.env'));
  const serverEnv = readEnvFile(path.join(root, 'server', '.env'));
  assert(clientEnv.VITE_SUPABASE_URL === expectedUrl, 'client is not configured for authorized staging');
  assert(serverEnv.SUPABASE_URL === expectedUrl, 'server is not configured for authorized staging');
  assert(clientEnv.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_'), 'missing staging publishable key');
  const secretFile = serverEnv.SUPABASE_SECRET_KEY_FILE;
  assert(secretFile && path.isAbsolute(secretFile), 'staging secret key file must be absolute');
  const secretEnv = readEnvFile(secretFile);
  assert(secretEnv.SUPABASE_SECRET_KEY?.startsWith('sb_secret_'), 'missing staging secret key');

  const service = createClient(expectedUrl, secretEnv.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const runId = `${Date.now()}-${randomBytes(3).toString('hex')}`;
  const accounts = [];
  let server;

  console.log(`MODEL_REQUEST_ID ${modelRequestId}`);
  await removeStaleUsers(service);

  try {
    const freeUser = await createAccount(
      service,
      clientEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
      runId,
      'free-user',
    );
    const proUser = await createAccount(
      service,
      clientEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
      runId,
      'pro-user',
    );
    accounts.push(freeUser, proUser);
    pass('D7-1', 'two confirmed temporary staging users can sign in');

    const plans = await expectNoError(await service.from('plans').select('id,name'), 'load plans');
    const freePlan = plans.find((plan) => plan.name === 'Free');
    const proPlan = plans.find((plan) => plan.name === 'Pro');
    assert(freePlan && proPlan, 'Free/Pro plans are missing');

    const baselineSubscriptions = await expectNoError(
      await service.from('subscriptions')
        .select('user_id,plan_id,status,quota_used')
        .in('user_id', accounts.map((account) => account.id)),
      'load new-user subscriptions',
    );
    assert(
      baselineSubscriptions.length === 2
        && baselineSubscriptions.every((row) => row.plan_id === freePlan.id && row.status === 'active'),
      'new users did not receive active Free subscriptions',
    );
    pass('D7-2', 'new-user subscription trigger is active and starts both users on Free');

    await seedSixDays(service, freeUser.id);
    const freeAttempts = await Promise.all(
      Array.from({ length: 8 }, () => service.rpc('apply_daily_checkin', { _user_id: freeUser.id })),
    );
    assert(freeAttempts.every((result) => !result.error), 'concurrent Free check-in RPC failed');
    const freeResults = freeAttempts.map((result) => result.data);
    assert(freeResults.filter((result) => result.reward_earned === true).length === 1, 'Free reward was not earned exactly once');

    const freeCheckins = await expectNoError(
      await service.from('daily_checkins').select('checkin_date_hk,streak_count').eq('user_id', freeUser.id),
      'load Free check-ins',
    );
    const freeGrant = await expectNoError(
      await service.from('membership_grants').select('*').eq('user_id', freeUser.id).single(),
      'load Free reward grant',
    );
    const freeSubscription = await expectNoError(
      await service.from('subscriptions')
        .select('plan_id,status,quota_used,current_period_start,current_period_end')
        .eq('user_id', freeUser.id)
        .single(),
      'load upgraded Free subscription',
    );
    assert(freeCheckins.length === 7, 'concurrent Free check-in created duplicate or missing days');
    assert(freeGrant.status === 'applied' && freeGrant.duration_days === 30, 'Free reward was not applied');
    assert(
      freeSubscription.plan_id === proPlan.id
        && freeSubscription.status === 'active'
        && freeSubscription.quota_used === 0,
      'Free subscription was not upgraded to fresh Pro',
    );
    const freePeriodDays = (
      new Date(freeSubscription.current_period_end).getTime()
      - new Date(freeSubscription.current_period_start).getTime()
    ) / 86_400_000;
    assert(freePeriodDays > 29.99 && freePeriodDays < 30.01, 'Free reward period is not 30 days');
    const freeRetry = await service.rpc('apply_daily_checkin', { _user_id: freeUser.id });
    assert(!freeRetry.error && freeRetry.data.reward_earned === false, 'same-day Free retry was not idempotent');
    pass('D7-3', '8 concurrent day-7 calls create one check-in, one grant, and one 30-day Pro upgrade');

    const ownCheckins = await expectNoError(
      await freeUser.client.from('daily_checkins').select('user_id,checkin_date_hk'),
      'read own check-ins',
    );
    const crossCheckins = await expectNoError(
      await proUser.client.from('daily_checkins').select('user_id').eq('user_id', freeUser.id),
      'read cross-user check-ins',
    );
    const forgedCheckin = await proUser.client.from('daily_checkins').insert({
      user_id: proUser.id,
      checkin_date_hk: hkDate(),
      streak_count: 99,
      streak_started_on: hkDate(-98),
    });
    const directCheckinRpc = await freeUser.client.rpc('apply_daily_checkin', { _user_id: freeUser.id });
    assert(ownCheckins.length === 7, 'owner cannot read own check-ins');
    assert(crossCheckins.length === 0, 'cross-user check-in rows leaked');
    assert(forgedCheckin.error, 'browser could forge a check-in row');
    assert(directCheckinRpc.error, 'browser could call service-role check-in RPC');
    pass('D7-4', 'owner reads are isolated and browser writes/direct RPC calls fail closed');

    const now = Date.now();
    await expectNoError(
      await service.from('subscriptions').update({
        plan_id: proPlan.id,
        status: 'active',
        quota_used: 17,
        current_period_start: new Date(now - 86_400_000).toISOString(),
        current_period_end: new Date(now + (10 * 86_400_000)).toISOString(),
      }).eq('user_id', proUser.id),
      'seed active Pro subscription',
    );
    await seedSixDays(service, proUser.id);
    const proAttempts = await Promise.all(
      Array.from({ length: 8 }, () => service.rpc('apply_daily_checkin', { _user_id: proUser.id })),
    );
    assert(proAttempts.every((result) => !result.error), 'concurrent active-Pro check-in RPC failed');
    assert(
      proAttempts.map((result) => result.data).filter((result) => result.reward_earned === true).length === 1,
      'active-Pro reward was not earned exactly once',
    );
    const pendingGrant = await expectNoError(
      await service.from('membership_grants').select('*').eq('user_id', proUser.id).single(),
      'load pending reward',
    );
    const activeSubscription = await expectNoError(
      await service.from('subscriptions').select('quota_used,current_period_end').eq('user_id', proUser.id).single(),
      'load active Pro subscription',
    );
    assert(pendingGrant.status === 'pending' && pendingGrant.subscription_id === null, 'active Pro did not receive pending grant');
    assert(activeSubscription.quota_used === 17, 'pending reward reset active Pro quota');

    const activeClaim = await service.rpc('claim_checkin_membership_grant', {
      _user_id: proUser.id,
      _grant_id: pendingGrant.id,
    });
    const crossClaim = await service.rpc('claim_checkin_membership_grant', {
      _user_id: freeUser.id,
      _grant_id: pendingGrant.id,
    });
    assert(!activeClaim.error && activeClaim.data.reason === 'active_pro', 'active Pro claim was not blocked');
    assert(!crossClaim.error && crossClaim.data.reason === 'not_found', 'cross-user claim did not fail closed');

    await expectNoError(
      await service.from('subscriptions').update({
        status: 'expired',
        current_period_start: new Date(now - (40 * 86_400_000)).toISOString(),
        current_period_end: new Date(now - 86_400_000).toISOString(),
      }).eq('user_id', proUser.id),
      'expire Pro subscription',
    );
    const claimed = await service.rpc('claim_checkin_membership_grant', {
      _user_id: proUser.id,
      _grant_id: pendingGrant.id,
    });
    const claimedAgain = await service.rpc('claim_checkin_membership_grant', {
      _user_id: proUser.id,
      _grant_id: pendingGrant.id,
    });
    assert(!claimed.error && claimed.data.success === true && claimed.data.idempotent === false, 'expired Pro reward claim failed');
    assert(!claimedAgain.error && claimedAgain.data.idempotent === true, 'repeat reward claim was not idempotent');
    const claimedSubscription = await expectNoError(
      await service.from('subscriptions').select('plan_id,status,quota_used').eq('user_id', proUser.id).single(),
      'load claimed subscription',
    );
    assert(
      claimedSubscription.plan_id === proPlan.id
        && claimedSubscription.status === 'active'
        && claimedSubscription.quota_used === 0,
      'claimed reward did not start fresh Pro',
    );
    pass('D7-5', 'active Pro gets one pending grant; early/cross-owner claims fail; expired claim applies once');

    const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    server = spawn(process.execPath, [tsxCli, path.join(root, 'server', 'src', 'local.ts')], {
      cwd: path.join(root, 'server'),
      env: { ...process.env, PORT: '3004' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let serverLogs = '';
    server.stdout.on('data', (chunk) => { serverLogs += chunk.toString(); });
    server.stderr.on('data', (chunk) => { serverLogs += chunk.toString(); });
    await waitForServer(server);
    assert(/server[\\/]\.env/.test(serverLogs), 'API server did not load server/.env');
    const anonymousActivity = await api('/me/activity', null, { method: 'POST', body: '{}' });
    const activity1 = await api('/me/activity', freeUser.token, { method: 'POST', body: JSON.stringify({ userId: proUser.id, date: '2000-01-01' }) });
    const activity2 = await api('/me/activity', freeUser.token, { method: 'POST', body: '{}' });
    assert(anonymousActivity.status === 401, `anonymous activity returned ${anonymousActivity.status}`);
    assert(activity1.status === 204 && activity2.status === 204, 'authenticated activity endpoint failed');
    const activityRows = await expectNoError(
      await service.from('app_activity_daily').select('*').eq('user_id', freeUser.id),
      'load activity rows',
    );
    const forgedOwnerActivity = await expectNoError(
      await service.from('app_activity_daily').select('*').eq('user_id', proUser.id),
      'check forged activity owner',
    );
    const browserActivityRead = await freeUser.client.from('app_activity_daily').select('*');
    const browserActivityWrite = await freeUser.client.from('app_activity_daily').insert({
      user_id: freeUser.id,
      activity_date_hk: hkDate(),
    });
    assert(activityRows.length === 1 && activityRows[0].activity_date_hk === hkDate(), 'activity did not deduplicate on HK date');
    assert(activityRows[0].last_seen_at >= activityRows[0].first_seen_at, 'activity timestamps are invalid');
    assert(forgedOwnerActivity.length === 0, 'client body changed server-owned activity owner');
    assert(browserActivityRead.error && browserActivityWrite.error, 'browser gained direct activity-table access');
    pass('D7-6', 'activity BFF authenticates, ignores forged owner/date, deduplicates by HK day, and keeps table private');

    const validModelRow = {
      request_id: modelRequestId,
      operation: 'generate',
      provider: 'deepseek',
      model: 'deepseek-chat',
      status: 'success',
      error_class: null,
      latency_ms: 12,
      attempt: 1,
      prompt_tokens: 10,
      completion_tokens: 4,
      total_tokens: 14,
      cache_hit_tokens: 0,
      cache_miss_tokens: 10,
      usage_source: 'provider',
    };
    await expectNoError(await service.from('model_call_logs').insert(validModelRow), 'insert valid model telemetry');
    const modelRows = await expectNoError(
      await service.from('model_call_logs').select('request_id,total_tokens').eq('request_id', modelRequestId),
      'read valid model telemetry',
    );
    const invalidModelRow = await service.from('model_call_logs').insert({
      ...validModelRow,
      request_id: randomUUID(),
      usage_source: 'unavailable',
    });
    const browserModelRead = await freeUser.client.from('model_call_logs').select('*');
    const browserModelWrite = await freeUser.client.from('model_call_logs').insert(validModelRow);
    assert(modelRows.length === 1 && modelRows[0].total_tokens === 14, 'valid model telemetry did not persist');
    assert(invalidModelRow.error, 'invalid usage-source/token combination passed constraints');
    assert(browserModelRead.error && browserModelWrite.error, 'browser gained direct model-log access');
    pass('D7-7', 'service model telemetry persists, invalid usage fails, and browser access is denied');
  } finally {
    await stopServer(server);
    for (const account of accounts) {
      await account.client.auth.signOut().catch(() => undefined);
      const { error } = await service.auth.admin.deleteUser(account.id);
      if (error) console.error(`CLEANUP_ERROR ${account.label}`);
    }
    await removeStaleUsers(service);
    console.log(`CLEANUP_MODEL_REQUEST_ID ${modelRequestId}`);
    console.log('CLEANUP temporary users and their cascaded test rows removed');
  }
}

main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : 'unknown D7 acceptance error'}`);
  process.exitCode = 1;
});
