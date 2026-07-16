import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedRef = 'wzpaghnxlpfjojvuxplx';
const expectedUrl = `https://${expectedRef}.supabase.co`;
const apiBase = 'http://127.0.0.1:3003/api';
const testPrefix = 'codex-staging-rls-';

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

async function api(pathname, token, options = {}) {
  const response = await fetch(`${apiBase}${pathname}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);
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
    if (error) throw new Error(`failed to inspect stale staging users: ${error.message}`);
    const stale = data.users.filter((user) => user.email?.startsWith(testPrefix));
    for (const user of stale) {
      const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
      if (deleteError) throw new Error(`failed to remove stale staging user: ${deleteError.message}`);
    }
    if (data.users.length < 100) break;
  }
}

async function main() {
  const clientEnv = readEnvFile(path.join(root, 'client', '.env'));
  const serverEnv = readEnvFile(path.join(root, 'server', '.env'));
  assert(clientEnv.VITE_SUPABASE_URL === expectedUrl, 'client is not configured for the authorized staging project');
  assert(serverEnv.SUPABASE_URL === expectedUrl, 'server is not configured for the authorized staging project');
  assert(clientEnv.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_'), 'missing staging publishable key');
  const secretFile = serverEnv.SUPABASE_SECRET_KEY_FILE;
  assert(secretFile && path.isAbsolute(secretFile), 'staging secret key file must be an absolute path');
  const secretEnv = readEnvFile(secretFile);
  assert(secretEnv.SUPABASE_SECRET_KEY?.startsWith('sb_secret_'), 'missing staging secret key');

  const service = createClient(expectedUrl, secretEnv.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const publishableKey = clientEnv.VITE_SUPABASE_PUBLISHABLE_KEY;
  const runId = `${Date.now()}-${randomBytes(3).toString('hex')}`;
  const specs = [
    { label: 'user-a', group: 'group-a', admin: false },
    { label: 'user-b', group: 'group-b', admin: false },
    { label: 'admin-a', group: 'group-a', admin: true },
    { label: 'admin-b', group: 'group-b', admin: true },
  ];
  const accounts = new Map();
  let server;

  await removeStaleUsers(service);

  try {
    for (const spec of specs) {
      const email = `${testPrefix}${runId}-${spec.label}@example.invalid`;
      const password = `T7!${randomBytes(24).toString('hex')}`;
      const created = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: `Staging ${spec.label}` },
      });
      if (created.error || !created.data.user) {
        throw new Error(`failed to create ${spec.label}: ${created.error?.message ?? 'unknown error'}`);
      }
      const browser = createClient(expectedUrl, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const login = await browser.auth.signInWithPassword({ email, password });
      if (login.error || !login.data.session) throw new Error(`failed to sign in ${spec.label}`);
      accounts.set(spec.label, {
        ...spec,
        id: created.data.user.id,
        email,
        password,
        client: browser,
        token: login.data.session.access_token,
      });
    }
    pass('S2', 'four confirmed temporary users can sign in');

    const userA = accounts.get('user-a');
    const userB = accounts.get('user-b');
    const adminA = accounts.get('admin-a');
    const adminB = accounts.get('admin-b');
    const ids = [...accounts.values()].map((account) => account.id);

    const wrongPassword = await userA.client.auth.signInWithPassword({
      email: userA.email,
      password: `${userA.password}wrong`,
    });
    assert(wrongPassword.error, 'wrong password unexpectedly succeeded');
    await userA.client.auth.signOut();
    const relogin = await userA.client.auth.signInWithPassword({ email: userA.email, password: userA.password });
    assert(!relogin.error && relogin.data.session, 'sign-out/sign-in cycle failed');
    userA.token = relogin.data.session.access_token;
    pass('S2', 'wrong password fails closed and sign-out/sign-in succeeds');

    const baselineProfiles = await expectNoError(
      await service.from('profiles').select('id,review_group').in('id', ids),
      'load baseline profiles',
    );
    assert(baselineProfiles.length === 4 && baselineProfiles.every((row) => row.review_group === null), 'new profiles are not neutral');
    const baselineRoles = await expectNoError(
      await service.from('user_roles').select('user_id,role').in('user_id', ids),
      'load baseline roles',
    );
    assert(baselineRoles.length === 4 && baselineRoles.every((row) => row.role === 'user'), 'new users are not fixed to user role');

    const plans = await expectNoError(await service.from('plans').select('id,name'), 'load plans');
    const freePlan = plans.find((plan) => plan.name === 'Free');
    const proPlan = plans.find((plan) => plan.name === 'Pro');
    assert(freePlan && proPlan, 'Free/Pro plans missing');
    const baselineSubs = await expectNoError(
      await service.from('subscriptions').select('user_id,plan_id').in('user_id', ids),
      'load baseline subscriptions',
    );
    assert(baselineSubs.length === 4 && baselineSubs.every((row) => row.plan_id === freePlan.id), 'new users are not fixed to Free');

    const roleEscalation = await userA.client.from('user_roles').insert({ user_id: userA.id, role: 'admin' });
    assert(roleEscalation.error, 'user could self-assign admin');
    const groupEscalation = await userA.client.from('profiles').update({ review_group: 'group-a' }).eq('id', userA.id);
    assert(groupEscalation.error, 'user could self-assign review_group');
    const planEscalation = await userA.client.from('subscriptions').update({ plan_id: proPlan.id }).eq('user_id', userA.id);
    assert(planEscalation.error, 'user could self-assign Pro');
    pass('S3', 'new accounts are user/Free and cannot self-assign admin, review group, or Pro');

    for (const account of accounts.values()) {
      await expectNoError(
        await service.from('profiles').update({ review_group: account.group }).eq('id', account.id).select('id').single(),
        `assign ${account.label} review group`,
      );
      if (account.admin) {
        await expectNoError(
          await service.from('user_roles').insert({ user_id: account.id, role: 'admin' }).select('id').single(),
          `assign ${account.label} admin role`,
        );
      }
    }

    async function seedOwner(account) {
      const suffix = `${runId}-${account.label}`;
      const job = await expectNoError(
        await service.from('generation_jobs').insert({
          owner_id: account.id,
          idempotency_key: `job-${suffix}`,
          source: `staging source ${account.label}`,
        }).select('id').single(),
        `seed ${account.label} job through trusted writer`,
      );
      const favorite = await expectNoError(
        await account.client.from('favorites').insert({
          owner_id: account.id,
          client_id: `favorite-${suffix}`,
          variant_key: 'standardHK',
          content: `staging review copy ${account.label}`,
          source: `staging source ${account.label}`,
          settings: { brandName: `Brand ${account.label}`, copyType: 'social', publishPlatform: 'IG' },
          is_user_authored: true,
          review_requested: true,
        }).select('id,review_requested,review_requested_at').single(),
        `seed ${account.label} favorite`,
      );
      assert(favorite.review_requested && favorite.review_requested_at, 'review request timestamp was not database-owned');
      const config = await expectNoError(
        await account.client.from('saved_configs').insert({
          owner_id: account.id,
          client_id: `config-${suffix}`,
          name: `Config ${account.label}`,
          config: { tone: 'steady', marker: account.label },
        }).select('id,name').single(),
        `seed ${account.label} config`,
      );
      const brand = await expectNoError(
        await account.client.from('brand_profiles').insert({
          owner_id: account.id,
          brand_name: `Brand ${account.label}`,
          product_name: `Product ${account.label}`,
        }).select('id').single(),
        `seed ${account.label} brand`,
      );
      const caseEntry = await expectNoError(
        await account.client.from('case_library_entries').insert({
          owner_id: account.id,
          case_type: 'good',
          title: `Case ${account.label}`,
          body: `This is isolated staging case content for ${account.label}.`,
          reason: 'RLS acceptance',
          tags: ['staging'],
        }).select('id').single(),
        `seed ${account.label} case`,
      );
      return { job: job.id, favorite: favorite.id, config: config.id, configName: config.name, brand: brand.id, caseEntry: caseEntry.id };
    }

    const rowsA = await seedOwner(userA);
    const rowsB = await seedOwner(userB);

    const ownerChecks = [
      ['profiles', 'id', userB.id],
      ['generation_jobs', 'id', rowsB.job],
      ['favorites', 'id', rowsB.favorite],
      ['saved_configs', 'id', rowsB.config],
      ['brand_profiles', 'id', rowsB.brand],
      ['case_library_entries', 'id', rowsB.caseEntry],
    ];
    for (const [table, column, value] of ownerChecks) {
      const data = await expectNoError(await userA.client.from(table).select('*').eq(column, value), `cross-owner read ${table}`);
      assert(data.length === 0, `User A could read User B ${table}`);
    }
    const crossRoleRead = await expectNoError(
      await userA.client.from('user_roles').select('role').eq('user_id', userB.id),
      'cross-owner role read',
    );
    assert(crossRoleRead.length === 0, 'User A could read User B roles');

    const crossConfigUpdate = await userA.client.from('saved_configs').update({ name: 'compromised' }).eq('id', rowsB.config).select('id');
    assert(!crossConfigUpdate.error && crossConfigUpdate.data.length === 0, 'cross-owner config update was not hidden');
    const configAfter = await expectNoError(
      await service.from('saved_configs').select('name').eq('id', rowsB.config).single(),
      'verify cross-owner config update',
    );
    assert(configAfter.name === rowsB.configName, 'cross-owner config was modified');
    const crossOwnerInsert = await userA.client.from('saved_configs').insert({
      owner_id: userB.id,
      client_id: `forged-${runId}`,
      name: 'forged',
      config: {},
    });
    assert(crossOwnerInsert.error, 'User A could insert a User B config');
    pass('S4', 'owner RLS blocks cross-user reads, updates, and forged config ownership');

    const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    server = spawn(process.execPath, [tsxCli, path.join(root, 'server', 'src', 'index.ts')], {
      cwd: path.join(root, 'server'),
      env: { ...process.env, PORT: '3003' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let serverLogs = '';
    server.stdout.on('data', (chunk) => { serverLogs += chunk.toString(); });
    server.stderr.on('data', (chunk) => { serverLogs += chunk.toString(); });
    await waitForServer(server);
    assert(/server[\\/]\.env/.test(serverLogs), 'API server did not load server/.env');

    const unauth = await api('/admin/favorites/pending-summary');
    assert(unauth.status === 401, `unauthenticated admin API returned ${unauth.status}`);
    const invalid = await api('/admin/favorites/pending-summary', 'invalid-token');
    assert(invalid.status === 401, `invalid JWT returned ${invalid.status}`);
    const ordinaryUser = await api('/admin/favorites/pending-summary', userA.token);
    assert(ordinaryUser.status === 403, `ordinary user admin API returned ${ordinaryUser.status}`);

    const pendingA = await api('/admin/favorites/pending-summary', adminA.token);
    const pendingB = await api('/admin/favorites/pending-summary', adminB.token);
    assert(pendingA.status === 200 && pendingA.body.count === 1, 'Admin A pending count is not group-a only');
    assert(pendingB.status === 200 && pendingB.body.count === 1, 'Admin B pending count is not group-b only');
    const crossDetail = await api(`/admin/favorites/${rowsB.favorite}`, adminA.token);
    assert(crossDetail.status === 404, `cross-group admin detail returned ${crossDetail.status}`);
    const crossReview = await api(`/admin/favorites/${rowsB.favorite}/review`, adminA.token, {
      method: 'PUT',
      body: JSON.stringify({ status: 'adopted', note: null, annotations: [] }),
    });
    assert(crossReview.status === 404, `cross-group admin review returned ${crossReview.status}`);
    const directRpc = await adminA.client.rpc('admin_save_favorite_review', {
      _actor_id: adminA.id,
      _favorite_id: rowsA.favorite,
      _status: 'adopted',
      _note: null,
      _annotations: [],
    });
    assert(directRpc.error, 'authenticated admin could directly execute service-role review RPC');
    pass('S6', 'admin API is authenticated, role-gated, group-scoped, and RPC cannot be called directly');

    const adopted = await api(`/admin/favorites/${rowsA.favorite}/review`, adminA.token, {
      method: 'PUT',
      body: JSON.stringify({ status: 'adopted', note: null, annotations: [] }),
    });
    assert(adopted.status === 200 && adopted.body.reviewStatus === 'adopted', 'same-group adopted review failed');
    const pendingAfterAdopt = await api('/admin/favorites/pending-summary', adminA.token);
    assert(pendingAfterAdopt.status === 200 && pendingAfterAdopt.body.count === 0, 'pending count did not decrease after review');
    const bootstrapAdopted = await api('/sync/bootstrap', userA.token);
    assert(bootstrapAdopted.status === 200, 'User A bootstrap failed');
    assert(bootstrapAdopted.body.favorites.length === 1, 'User A bootstrap owner isolation failed');
    assert(bootstrapAdopted.body.savedConfigs.length === 1, 'User A config bootstrap failed');
    assert(bootstrapAdopted.body.brandProfile, 'User A brand bootstrap failed');
    assert(bootstrapAdopted.body.favorites[0].adminReview?.status === 'adopted', 'owner did not receive adopted review');

    const revised = await expectNoError(
      await userA.client.from('favorites').update({ content: 'staging revised copy user-a' }).eq('id', rowsA.favorite).select('content_revision').single(),
      'revise User A favorite',
    );
    assert(revised.content_revision === 2, 'content revision did not increment');
    const pendingAfterEdit = await api('/admin/favorites/pending-summary', adminA.token);
    assert(pendingAfterEdit.status === 200 && pendingAfterEdit.body.count === 1, 'content edit did not re-enter pending queue');
    const bootstrapAfterEdit = await api('/sync/bootstrap', userA.token);
    assert(bootstrapAfterEdit.body.favorites[0].adminReview === null, 'stale review survived content edit');

    const changesRequested = await api(`/admin/favorites/${rowsA.favorite}/review`, adminA.token, {
      method: 'PUT',
      body: JSON.stringify({ status: 'changes_requested', note: 'Please revise the opening.', annotations: [] }),
    });
    assert(changesRequested.status === 200 && changesRequested.body.reviewStatus === 'changes_requested', 'same-group changes-requested review failed');
    const bootstrapChanges = await api('/sync/bootstrap', userA.token);
    assert(bootstrapChanges.body.favorites[0].adminReview?.status === 'changes_requested', 'owner did not receive changes-requested review');
    assert(bootstrapChanges.body.favorites[0].adminReview?.note === 'Please revise the opening.', 'owner review note mismatch');
    const userBCrossReview = await expectNoError(
      await userB.client.from('favorite_admin_reviews').select('favorite_id').eq('favorite_id', rowsA.favorite),
      'cross-owner review read',
    );
    assert(userBCrossReview.length === 0, 'User B could read User A review result');
    pass('S7-S8', 'review results reach the owner, pending counts update, and edits create a fresh review cycle');

    const bootstrapB = await api('/sync/bootstrap', userB.token);
    assert(bootstrapB.status === 200, 'User B bootstrap failed');
    assert(bootstrapB.body.favorites.length === 1 && bootstrapB.body.savedConfigs.length === 1 && bootstrapB.body.brandProfile, 'User B bootstrap data mismatch');
    assert(bootstrapB.body.favorites[0].id !== rowsA.favorite, 'User B bootstrap leaked User A favorite');
    pass('S5', 'cloud bootstrap binds favorites, configs, and brand profile to the current owner');
    pass('S9', 'unauthenticated, invalid-token, ordinary-user, and cross-group requests fail closed');
  } finally {
    await stopServer(server);
    const ids = [...accounts.values()].map((account) => account.id);
    if (ids.length > 0) {
      await service.from('audit_log').delete().in('actor', ids);
      for (const account of accounts.values()) {
        await account.client.auth.signOut().catch(() => undefined);
        const { error } = await service.auth.admin.deleteUser(account.id);
        if (error) console.error(`CLEANUP_ERROR ${account.label}`);
      }
    }
    await removeStaleUsers(service);
    console.log('CLEANUP temporary users and test data removed');
  }
}

main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : 'unknown acceptance error'}`);
  process.exitCode = 1;
});
