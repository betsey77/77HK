import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedRef = 'wzpaghnxlpfjojvuxplx';
const expectedUrl = `https://${expectedRef}.supabase.co`;
const testPrefix = 'codex-staging-e8-';
const realApiBase = 'http://127.0.0.1:3005/api';
const failureApiBase = 'http://127.0.0.1:3006/api';

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

async function expectData(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function api(base, pathname, token, options = {}) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  return {
    status: response.status,
    body: await response.json().catch(() => null),
  };
}

async function waitForServer(base, child, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`${label} exited before becoming ready`);
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return response.json();
    } catch {
      // Bounded readiness polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not become ready`);
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

function startServer(port, envOverrides = {}) {
  const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const child = spawn(process.execPath, [tsxCli, path.join(root, 'server', 'src', 'local.ts')], {
    cwd: path.join(root, 'server'),
    env: { ...process.env, PORT: String(port), ...envOverrides },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let logs = '';
  child.stdout.on('data', (chunk) => { logs += chunk.toString(); });
  child.stderr.on('data', (chunk) => { logs += chunk.toString(); });
  return { child, getLogs: () => logs };
}

async function removeStaleUsers(service) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`failed to inspect stale E8 users: ${error.message}`);
    const stale = data.users.filter((user) => user.email?.startsWith(testPrefix));
    if (stale.length > 0) {
      const ids = stale.map((user) => user.id);
      await service.from('audit_log').delete().in('actor', ids);
      for (const user of stale) {
        const removed = await service.auth.admin.deleteUser(user.id);
        if (removed.error) throw new Error(`failed to remove stale E8 user: ${removed.error.message}`);
      }
    }
    if (data.users.length < 100) break;
  }
}

async function createAccount(service, publishableKey, runId, label, role) {
  const email = `${testPrefix}${runId}-${label}@example.invalid`;
  const password = `T7!${randomBytes(24).toString('hex')}`;
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `E8 ${label}` },
  });
  if (created.error || !created.data.user) {
    throw created.error ?? new Error(`failed to create ${label}`);
  }
  const client = createClient(expectedUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error || !login.data.session) throw new Error(`failed to sign in ${label}`);
  if (role !== 'user') {
    await expectData(
      await service.from('user_roles').insert({ user_id: created.data.user.id, role }).select('id').single(),
      `assign ${label} role`,
    );
  }
  return {
    id: created.data.user.id,
    email,
    client,
    token: login.data.session.access_token,
    role,
  };
}

function capturedInput(model) {
  return {
    generatePromptVariant: 'deepseek',
    resolvedParams: {
      platform: 'ig',
      primaryTone: 'professional',
      toneModifiers: [],
      cantoneseLevel: 3,
      englishMixingLevel: 1,
      creativityLevel: 2,
      inputLanguage: 'mandarin',
      copyType: 'social',
      lengthControlEnabled: true,
      copyLengthLevel: 3,
      refresh: false,
      hasBrandName: true,
      hasProductName: true,
      hasBrandRedLines: true,
      productSellingPointCount: 1,
      selectedCaseLibraryIds: [],
      referenceCaseIds: [],
      calendarEventIds: [],
    },
    caseLibrary: {
      requestedIds: [],
      resolvedIds: [],
      partialUnavailable: false,
      resolvedMeta: [],
    },
    referenceCases: [],
    calendarEventIds: [],
    model: {
      requireRealModel: false,
      hasConfiguredRealModel: true,
      generationTimeoutMs: 25_000,
      qualityScoreTimeoutMs: 8_000,
      postProcessingTimeoutMs: 35_000,
      allowQualityRetry: true,
      defaultModel: model,
      thinkingDisabled: true,
      temperature: null,
    },
  };
}

const LOW_SCORES = {
  generated: {
    total: 28,
    cantoneseNaturalness: 25,
    brandSafety: 30,
    platformFit: 30,
    readability: 35,
    creativity: 25,
    hookStrength: 20,
    emojiHashtagFit: 30,
    engagementPotential: 25,
  },
};

const LOW_VARIANTS = {
  standardHK: '全港第一，保證人人都鍾意。',
  lightCantonese: '全港第一，保證大家都鍾意。',
  ig: '全港第一，保證人人都鍾意。#測試',
  facebook: '全港第一，保證人人都鍾意。',
  shorts: '全港第一，保證人人都鍾意。',
};

async function seedCompletedJob(service, ownerId, runId, label) {
  return expectData(
    await service.from('generation_jobs').insert({
      owner_id: ownerId,
      idempotency_key: `e8-${runId}-${label}`,
      status: 'completed',
      source: `E8 staging ${label} sample`,
      platform: 'ig',
      tone: 'professional',
      brand_name: 'E8 Staging Brand',
      product_name: 'E8 Staging Product',
      brand_red_lines: '不得使用绝对化用语',
      brief: {
        productSellingPoints: [{ original: '测试卖点', cantonese: '測試賣點' }],
      },
      variants: LOW_VARIANTS,
      diagnosis: { issues: ['synthetic staging bad case'] },
      audit: { thermometer: { overall: 28 }, issues: [], risks: [] },
      scores: LOW_SCORES,
      generation_engine: 'deepseek',
      completed_at: new Date().toISOString(),
    }).select('id,owner_id').single(),
    `seed ${label} completed job`,
  );
}

async function seedFailedJob(service, ownerId, runId) {
  return expectData(
    await service.from('generation_jobs').insert({
      owner_id: ownerId,
      idempotency_key: `e8-${runId}-generation-failed`,
      status: 'failed',
      source: 'E8 staging synthetic failed generation',
      error_code: 'GENERATION_ERROR',
      error_message: 'Synthetic staging provider failure',
      completed_at: new Date().toISOString(),
    }).select('id,owner_id').single(),
    'seed failed job',
  );
}

async function packForJob(service, jobId) {
  return expectData(
    await service.from('bad_case_review_packs')
      .select('id,generation_job_id,trigger_kind,status,analysis_status,criteria_version')
      .eq('generation_job_id', jobId)
      .single(),
    `load review pack for ${jobId}`,
  );
}

async function main() {
  const clientEnv = readEnvFile(path.join(root, 'client', '.env'));
  const serverEnv = readEnvFile(path.join(root, 'server', '.env'));
  const rootEnv = readEnvFile(path.join(root, '.env'));
  const runtimeEnv = { ...rootEnv, ...serverEnv };
  assert(clientEnv.VITE_SUPABASE_URL === expectedUrl, 'client is not configured for the authorized staging project');
  assert(runtimeEnv.SUPABASE_URL === expectedUrl, 'server is not configured for the authorized staging project');
  assert(clientEnv.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_'), 'missing staging publishable key');
  assert(runtimeEnv.DEEPSEEK_API_KEY, 'real DeepSeek key is not configured in the local runtime env');
  assert(runtimeEnv.SUPABASE_SECRET_KEY_FILE && path.isAbsolute(runtimeEnv.SUPABASE_SECRET_KEY_FILE), 'staging secret key file must be absolute');

  for (const [key, value] of Object.entries(runtimeEnv)) {
    if (process.env[key] == null && value) process.env[key] = value;
  }
  const secretEnv = readEnvFile(runtimeEnv.SUPABASE_SECRET_KEY_FILE);
  assert(secretEnv.SUPABASE_SECRET_KEY?.startsWith('sb_secret_'), 'missing staging service secret');

  const service = createClient(expectedUrl, secretEnv.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const {
    afterGenerationPersistReviewPack,
    buildManifestForGeneration,
  } = await import('../server/src/services/badCaseReviewPackService.ts');
  const { CRITERIA_VERSION } = await import('../server/src/services/badCaseCriteria.ts');

  const runId = `${Date.now()}-${randomBytes(3).toString('hex')}`;
  const accounts = [];
  const jobIds = [];
  const packIds = [];
  let realServer;
  let failureServer;
  let trackedModelLogIds = [];

  await removeStaleUsers(service);

  try {
    const owner = await createAccount(service, clientEnv.VITE_SUPABASE_PUBLISHABLE_KEY, runId, 'owner', 'user');
    const admin = await createAccount(service, clientEnv.VITE_SUPABASE_PUBLISHABLE_KEY, runId, 'admin', 'admin');
    const superAdmin = await createAccount(service, clientEnv.VITE_SUPABASE_PUBLISHABLE_KEY, runId, 'super', 'super_admin');
    accounts.push(owner, admin, superAdmin);
    pass('E8-1', 'temporary owner, admin, and super_admin have real staging JWTs');

    const manifest = buildManifestForGeneration({
      generationEngine: 'deepseek',
      captureInput: capturedInput(runtimeEnv.DEEPSEEK_MODEL || 'deepseek-v4-flash'),
    });
    assert(manifest.availability === 'captured', 'captured artifact manifest was not built');

    const lowJob = await seedCompletedJob(service, owner.id, runId, 'low-score');
    const analysisFailureJob = await seedCompletedJob(service, owner.id, runId, 'analysis-failure');
    const hiddenJob = await seedCompletedJob(service, owner.id, runId, 'hidden');
    const failedJob = await seedFailedJob(service, owner.id, runId);
    jobIds.push(lowJob.id, analysisFailureJob.id, hiddenJob.id, failedJob.id);

    const lowHookInput = {
      jobId: lowJob.id,
      ownerId: owner.id,
      status: 'completed',
      scores: LOW_SCORES,
      variants: LOW_VARIANTS,
      audit: { thermometer: { overall: 28 }, issues: [], risks: [] },
      brandRedLines: '不得使用绝对化用语',
      productSellingPoints: [{ original: '测试卖点', cantonese: '測試賣點' }],
      generationEngine: 'deepseek',
      artifactManifest: manifest,
    };
    const lowHookA = await afterGenerationPersistReviewPack(lowHookInput, { timeoutMs: 10_000 });
    const lowHookB = await afterGenerationPersistReviewPack(lowHookInput, { timeoutMs: 10_000 });
    assert(lowHookA.ok && lowHookB.ok && lowHookA.action === 'pack_upserted', 'completed-generation hook failed');
    const lowPack = await packForJob(service, lowJob.id);
    packIds.push(lowPack.id);
    const lowCreatedEvents = await expectData(
      await service.from('bad_case_review_events').select('id').eq('review_pack_id', lowPack.id).eq('event_type', 'pack_created'),
      'load low-score pack-created events',
    );
    assert(lowCreatedEvents.length === 1, 'completed hook was not idempotent');

    for (const [job, label] of [[analysisFailureJob, 'analysis failure'], [hiddenJob, 'hidden']]) {
      const result = await afterGenerationPersistReviewPack({ ...lowHookInput, jobId: job.id }, { timeoutMs: 10_000 });
      assert(result.ok, `${label} pack hook failed`);
      const pack = await packForJob(service, job.id);
      packIds.push(pack.id);
    }
    const analysisFailurePack = await packForJob(service, analysisFailureJob.id);
    const hiddenPack = await packForJob(service, hiddenJob.id);

    const failureManifest = buildManifestForGeneration({ generationEngine: null, captureInput: null });
    const failedHookInput = {
      jobId: failedJob.id,
      ownerId: owner.id,
      status: 'failed',
      errorCode: 'GENERATION_ERROR',
      generationEngine: null,
      artifactManifest: failureManifest,
    };
    const failedHookA = await afterGenerationPersistReviewPack(failedHookInput, { timeoutMs: 10_000 });
    const failedHookB = await afterGenerationPersistReviewPack(failedHookInput, { timeoutMs: 10_000 });
    assert(failedHookA.ok && failedHookB.ok, 'failed-generation hook failed');
    const failedPack = await packForJob(service, failedJob.id);
    packIds.push(failedPack.id);
    assert(failedPack.trigger_kind === 'generation_failed', 'failed generation did not create a failure pack');
    const failedCreatedEvents = await expectData(
      await service.from('bad_case_review_events').select('id').eq('review_pack_id', failedPack.id).eq('event_type', 'pack_created'),
      'load failed pack-created events',
    );
    assert(failedCreatedEvents.length === 1, 'failed-generation hook was not idempotent');
    pass('E8-2', 'real staging hook creates completed/failed packs idempotently');

    await expectData(
      await service.from('generation_jobs').update({ deleted_at: new Date().toISOString() }).eq('id', hiddenJob.id).select('id').single(),
      'soft-delete hidden job',
    );

    const realStarted = startServer(3005);
    realServer = realStarted.child;
    const health = await waitForServer(realApiBase, realServer, 'real-key API server');
    assert(health.deepseekConfigured === true, 'real-key API server did not load DeepSeek');

    assert((await api(realApiBase, '/admin/bad-case-review-packs')).status === 401, 'anonymous list did not return 401');
    assert((await api(realApiBase, '/admin/bad-case-review-packs', 'invalid-token')).status === 401, 'invalid JWT did not return 401');
    assert((await api(realApiBase, '/admin/bad-case-review-packs', owner.token)).status === 403, 'ordinary user did not return 403');

    const adminChecks = [
      ['/admin/bad-case-review-packs', 'GET', null],
      [`/admin/bad-case-review-packs/${lowPack.id}`, 'GET', null],
      [`/admin/bad-case-review-packs/${lowPack.id}/assign`, 'POST', { ownerTeam: 'content_prompt' }],
      [`/admin/bad-case-review-packs/${lowPack.id}/status`, 'POST', { status: 'triaging' }],
      [`/admin/bad-case-review-packs/${lowPack.id}/analyze`, 'POST', {}],
    ];
    for (const [pathname, method, body] of adminChecks) {
      const result = await api(realApiBase, pathname, admin.token, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      assert(result.status === 403, `ordinary admin ${method} ${pathname} returned ${result.status}`);
    }
    const directBrowserRead = await owner.client.from('bad_case_review_packs').select('id').eq('id', lowPack.id);
    assert(directBrowserRead.error || directBrowserRead.data.length === 0, 'browser role gained direct review-pack access');
    pass('E8-3', '401/403 and direct-table boundaries fail closed with real JWTs');

    const hiddenAuditBefore = await expectData(
      await service.from('audit_log').select('id').eq('actor', superAdmin.id).eq('entity_id', hiddenPack.id),
      'load hidden audit baseline',
    );
    const hiddenDetail = await api(realApiBase, `/admin/bad-case-review-packs/${hiddenPack.id}`, superAdmin.token);
    assert(hiddenDetail.status === 404, `hidden pack detail returned ${hiddenDetail.status}`);
    const hiddenAuditAfter = await expectData(
      await service.from('audit_log').select('id').eq('actor', superAdmin.id).eq('entity_id', hiddenPack.id),
      'load hidden audit after request',
    );
    assert(hiddenAuditAfter.length === hiddenAuditBefore.length, 'hidden pack wrote audit before scope rejection');

    const listed = await api(realApiBase, '/admin/bad-case-review-packs?limit=100', superAdmin.token);
    assert(listed.status === 200, `super_admin list returned ${listed.status}`);
    const listItem = listed.body.items.find((item) => item.id === lowPack.id);
    assert(listItem && !('sample' in listItem) && !('variants' in listItem), 'list leaked body fields or omitted seeded pack');

    const detail = await api(realApiBase, `/admin/bad-case-review-packs/${lowPack.id}`, superAdmin.token);
    assert(detail.status === 200, `super_admin detail returned ${detail.status}`);
    assert(detail.body.sample.source === 'E8 staging low-score sample', 'detail did not return the audited sample');
    assert(detail.body.artifacts.status === 'available', 'captured artifacts are unavailable');
    assert(Array.isArray(detail.body.findings) && detail.body.findings.length > 0, 'deterministic findings are missing');
    const detailAudits = await expectData(
      await service.from('audit_log')
        .select('id,action,entity,entity_id,created_at')
        .eq('actor', superAdmin.id)
        .eq('action', 'admin_view_bad_case_review_pack')
        .eq('entity_id', lowPack.id),
      'verify detail audit',
    );
    assert(detailAudits.length >= 1, 'detail body was returned without an audit row');
    pass('E8-4', 'super_admin list is metadata-only and detail is audited after scope');

    const forgedAssign = await api(realApiBase, `/admin/bad-case-review-packs/${lowPack.id}/assign`, superAdmin.token, {
      method: 'POST',
      body: JSON.stringify({ ownerTeam: 'content_prompt', actorId: owner.id }),
    });
    assert(forgedAssign.status === 400, 'forged actor field was accepted');
    const assigned = await api(realApiBase, `/admin/bad-case-review-packs/${lowPack.id}/assign`, superAdmin.token, {
      method: 'POST',
      body: JSON.stringify({ ownerTeam: 'content_prompt', assigneeId: admin.id, reason: 'E8 staging triage' }),
    });
    assert(assigned.status === 200 && assigned.body.assigneeId === admin.id, 'pack assignment failed');
    const triaged = await api(realApiBase, `/admin/bad-case-review-packs/${lowPack.id}/status`, superAdmin.token, {
      method: 'POST',
      body: JSON.stringify({ status: 'triaging', reason: 'E8 staging review' }),
    });
    assert(triaged.status === 200 && triaged.body.status === 'triaging', 'status transition failed');

    const findingId = detail.body.findings[0].id;
    const reviewed = await api(realApiBase, `/admin/bad-case-findings/${findingId}/review`, superAdmin.token, {
      method: 'POST',
      body: JSON.stringify({ disposition: 'confirmed', reviewerComment: 'E8 staging confirmed' }),
    });
    assert(reviewed.status === 200 && reviewed.body.disposition === 'confirmed', 'finding review failed');

    await expectData(
      await service.from('bad_case_review_packs')
        .update({ analysis_status: 'completed', criteria_version: CRITERIA_VERSION })
        .eq('id', lowPack.id)
        .select('id').single(),
      'prepare legacy deterministic completion',
    );
    const forgedAnalyze = await api(realApiBase, `/admin/bad-case-review-packs/${lowPack.id}/analyze`, superAdmin.token, {
      method: 'POST',
      body: JSON.stringify({ actorRole: 'super_admin' }),
    });
    assert(forgedAnalyze.status === 400, 'analyze accepted a forged actor field');

    const analyzed = await api(realApiBase, `/admin/bad-case-review-packs/${lowPack.id}/analyze`, superAdmin.token, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(analyzed.status === 200, `DeepSeek analysis returned HTTP ${analyzed.status}`);
    assert(analyzed.body.analysisStatus === 'completed', `DeepSeek analysis ended as ${analyzed.body.analysisStatus}`);
    assert(analyzed.body.provider === 'deepseek' && analyzed.body.analysisVersion, 'real DeepSeek completion metadata is missing');
    const analysisEventsBefore = await expectData(
      await service.from('bad_case_review_events')
        .select('id,event_type,payload,created_at')
        .eq('review_pack_id', lowPack.id)
        .in('event_type', ['analysis_requested', 'analysis_completed']),
      'load analysis events',
    );
    assert(analysisEventsBefore.filter((event) => event.event_type === 'analysis_requested').length === 1, 'legacy completion was not upgraded exactly once');
    assert(analysisEventsBefore.filter((event) => event.event_type === 'analysis_completed').length === 1, 'analysis completion event missing');

    const analyzedAgain = await api(realApiBase, `/admin/bad-case-review-packs/${lowPack.id}/analyze`, superAdmin.token, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(analyzedAgain.status === 200 && analyzedAgain.body.idempotent === true, 'second analysis was not idempotent');
    const analysisEventsAfter = await expectData(
      await service.from('bad_case_review_events')
        .select('id')
        .eq('review_pack_id', lowPack.id)
        .in('event_type', ['analysis_requested', 'analysis_completed']),
      'reload analysis events',
    );
    assert(analysisEventsAfter.length === analysisEventsBefore.length, 'idempotent analysis appended duplicate events');
    pass('E8-5', 'legacy completion upgrades through real DeepSeek once and then stays idempotent');

    const analyzedDetail = await api(realApiBase, `/admin/bad-case-review-packs/${lowPack.id}`, superAdmin.token);
    assert(analyzedDetail.status === 200 && analyzedDetail.body.analysisStatus === 'completed', 'analyzed detail did not refresh');
    const reviewedFinding = analyzedDetail.body.findings.find((finding) => finding.id === findingId);
    assert(reviewedFinding?.disposition === 'confirmed', 'analysis overwrote the human disposition');
    assert(String(analyzedDetail.body.summary).includes('DeepSeek='), 'DeepSeek summary is not reviewable');

    const rulesManifest = analyzedDetail.body.artifacts.rules;
    const rulesHash = analyzedDetail.body.artifacts.contentHashes.rules;
    const currentVersion = String(rulesManifest.version);
    const nextVersion = currentVersion === '1.0.1' ? '1.0.2' : '1.0.1';
    const staleProposal = await api(realApiBase, `/admin/bad-case-findings/${findingId}/proposal`, superAdmin.token, {
      method: 'POST',
      body: JSON.stringify({
        artifactType: 'rules',
        before: { contentHash: '0'.repeat(64), snapshot: { artifactType: 'rules', manifest: rulesManifest } },
        afterPatch: { ops: [{ op: 'replace', path: '/version', value: nextVersion }] },
        rationale: 'E8 stale hash check',
      }),
    });
    assert(staleProposal.status === 409, `stale proposal returned ${staleProposal.status}`);
    const proposal = await api(realApiBase, `/admin/bad-case-findings/${findingId}/proposal`, superAdmin.token, {
      method: 'POST',
      body: JSON.stringify({
        artifactType: 'rules',
        before: { contentHash: rulesHash, snapshot: { artifactType: 'rules', manifest: rulesManifest } },
        afterPatch: { ops: [{ op: 'replace', path: '/version', value: nextVersion }] },
        rationale: 'E8 review-only proposal',
      }),
    });
    assert(proposal.status === 200, `valid proposal returned ${proposal.status}`);
    assert(proposal.body.status === 'pending_review' && proposal.body.publishable === false && proposal.body.autoPublish === false, 'proposal escaped review-only state');

    const resolved = await api(realApiBase, `/admin/bad-case-review-packs/${lowPack.id}/status`, superAdmin.token, {
      method: 'POST',
      body: JSON.stringify({ status: 'resolved', reason: 'E8 staging accepted' }),
    });
    assert(resolved.status === 200 && resolved.body.resolvedAt, 'resolved transition failed');
    const diagnostics = await api(realApiBase, '/admin/bad-case-review-packs/diagnostics', superAdmin.token);
    assert(diagnostics.status === 200 && diagnostics.body.summary, 'diagnostics failed');
    const diagnosticsJson = JSON.stringify(diagnostics.body);
    assert(!diagnosticsJson.includes('E8 staging low-score sample') && !diagnosticsJson.includes(owner.email), 'diagnostics leaked sample or email');

    const eventTypes = (await expectData(
      await service.from('bad_case_review_events').select('event_type,actor_id,actor_role').eq('review_pack_id', lowPack.id),
      'verify review events',
    )).map((event) => event.event_type);
    for (const required of ['pack_created', 'pack_assigned', 'pack_status_changed', 'finding_reviewed', 'analysis_requested', 'analysis_completed', 'proposal_created']) {
      assert(eventTypes.includes(required), `missing ${required} event`);
    }
    pass('E8-6', 'assignment, status, finding review, stale-hash guard, proposal, events, and diagnostics close');

    await stopServer(realServer);
    realServer = undefined;
    const invalidProviderKey = `invalid-${runId}`;
    const failureStarted = startServer(3006, { DEEPSEEK_API_KEY: invalidProviderKey });
    failureServer = failureStarted.child;
    const failureHealth = await waitForServer(failureApiBase, failureServer, 'invalid-key API server');
    assert(failureHealth.deepseekConfigured === true, 'invalid-key server did not enter provider path');
    const unavailable = await api(failureApiBase, `/admin/bad-case-review-packs/${analysisFailurePack.id}/analyze`, superAdmin.token, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(unavailable.status === 200 && unavailable.body.analysisStatus === 'analysis_unavailable', 'provider failure did not reach safe unavailable state');
    assert(typeof unavailable.body.failureClass === 'string', 'provider failure class is missing');
    const failedAnalysisEvents = await expectData(
      await service.from('bad_case_review_events').select('event_type,payload').eq('review_pack_id', analysisFailurePack.id),
      'verify failed analysis event',
    );
    assert(failedAnalysisEvents.some((event) => event.event_type === 'analysis_failed'), 'analysis_failed event missing');
    assert(!JSON.stringify(unavailable.body).includes(invalidProviderKey), 'provider failure leaked a credential');
    pass('E8-7', 'invalid provider credentials fail safely with classified audit evidence');

    trackedModelLogIds = (await expectData(
      await service.from('model_call_logs').select('id,job_id').in('job_id', jobIds),
      'track E8 model telemetry',
    )).map((row) => row.id);
  } finally {
    await stopServer(failureServer);
    await stopServer(realServer);
    for (const account of accounts) {
      await account.client.auth.signOut().catch(() => undefined);
    }
    const accountIds = accounts.map((account) => account.id);
    if (accountIds.length > 0) {
      await service.from('audit_log').delete().in('actor', accountIds);
      for (const account of accounts) {
        const removed = await service.auth.admin.deleteUser(account.id);
        if (removed.error) console.error(`CLEANUP_ERROR ${account.role}`);
      }
    }
    await removeStaleUsers(service);

    if (jobIds.length > 0) {
      const jobs = await expectData(await service.from('generation_jobs').select('id').in('id', jobIds), 'verify job cleanup');
      const snapshots = await expectData(await service.from('generation_artifact_snapshots').select('id').in('generation_job_id', jobIds), 'verify snapshot cleanup');
      const packs = await expectData(await service.from('bad_case_review_packs').select('id').in('generation_job_id', jobIds), 'verify pack cleanup');
      assert(jobs.length === 0 && snapshots.length === 0 && packs.length === 0, 'QA jobs, snapshots, or packs remain');
    }
    if (packIds.length > 0) {
      const findings = await expectData(await service.from('bad_case_findings').select('id').in('review_pack_id', packIds), 'verify finding cleanup');
      const events = await expectData(await service.from('bad_case_review_events').select('id').in('review_pack_id', packIds), 'verify event cleanup');
      assert(findings.length === 0 && events.length === 0, 'QA findings or events remain');
    }
    if (trackedModelLogIds.length > 0) {
      const telemetry = await expectData(await service.from('model_call_logs').select('id,job_id').in('id', trackedModelLogIds), 'verify telemetry de-identification');
      assert(telemetry.every((row) => row.job_id === null), 'retained model telemetry still identifies a deleted QA job');
    }
    console.log('CLEANUP_ZERO_RESIDUE temporary users and E8 business rows removed; retained telemetry is de-identified');
  }
}

main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : 'unknown E8 staging acceptance error'}`);
  process.exitCode = 1;
});
