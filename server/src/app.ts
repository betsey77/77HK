import express from 'express';
import { DEFAULT_DEEPSEEK_MODEL, getModelRuntimePolicy } from './services/modelPolicy.js';
import cors from 'cors';
import generateRouter from './routes/generate.js';
import parsePersonasRouter from './routes/parsePersonas.js';
import modifyRouter from './routes/modify.js';
import quickCheckRouter from './routes/quickCheck.js';
import calendarRouter from './routes/calendar.js';
import inspirationRouter from './routes/inspiration.js';
import competitorRouter from './routes/competitor.js';
import meRouter from './routes/me.js';
import checkInRouter from './routes/checkIn.js';
import generationsRouter from './routes/generations.js';
import syncRouter from './routes/sync.js';
import feedbackRouter from './routes/feedback.js';
import caseLibraryRouter from './routes/caseLibrary.js';
import { billingRouter } from './routes/billing.js';
import adminRouter from './routes/admin.js';
import { isOriginAllowed } from './services/corsOrigins.js';

const app = express();

// Explicit origin allowlist (ALLOWED_ORIGINS). No wildcard *.vercel.app.
// Missing Origin (Alipay notify / server-to-server) is allowed.
app.use(cors({
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
}));

// Body size limit: 1 MiB
const BODY_LIMIT_BYTES = 1_048_576;

// ── Alipay notify: urlencoded parser MUST run BEFORE the global JSON parser ──
// Alipay sends async payment notifications as application/x-www-form-urlencoded.
// Mounted only on the notify path; does NOT affect other routes.
// The global JSON parser below skips when req.body is already populated.
app.use('/api/billing/alipay/notify', express.urlencoded({ extended: false, limit: '100kb' }));

// Body parser — manual for serverless compatibility
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') { next(); return; }
  // Skip if body already parsed — urlencoded middleware sets {} for empty bodies,
  // and attempting to read the stream again would hang (stream already consumed).
  if (req.body && typeof req.body === 'object') { next(); return; }

  const chunks: Buffer[] = [];
  let totalSize = 0;
  let exceeded = false;
  req.on('data', (chunk: Buffer) => {
    totalSize += chunk.length;
    if (totalSize > BODY_LIMIT_BYTES) {
      exceeded = true;
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (exceeded) {
      if (!res.headersSent) {
        res.status(413).json({ error: 'Request body too large' });
      }
      return;
    }
    const raw = Buffer.concat(chunks).toString('utf-8');
    if (!raw.trim()) {
      req.body = {};
      next();
      return;
    }
    try {
      req.body = JSON.parse(raw);
    } catch {
      // Invalid JSON — respond 400, do NOT silently fall back to {}
      if (!res.headersSent) {
        res.status(400).json({ error: 'Invalid JSON in request body' });
      }
      return;
    }
    next();
  });
  req.on('error', () => {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

app.get('/api/health', (_req, res) => {
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
  const modelPolicy = getModelRuntimePolicy();
  res.json({
    status: 'ok',
    selfHostedConfigured: !!process.env.CANTONESE_API_URL,
    deepseekConfigured: !!process.env.DEEPSEEK_API_KEY,
    deepseekModel: process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
    realModelRequired: modelPolicy.requireRealModel,
    realModelConfigured: modelPolicy.hasConfiguredRealModel,
    youtubeKeyConfigured: !!process.env.YOUTUBE_API_KEY,
    metaTokenConfigured: !!process.env.META_ACCESS_TOKEN,
    proxyConfigured: !!proxy,
  });
});

/** GET /api/connectivity — public health endpoint for external API reachability */
app.get('/api/connectivity', async (_req, res) => {
  // Production safeguard: only return basic status, do not probe external APIs
  // and never include proxy values or API key fragments.
  const proxyConfigured = !!(process.env.HTTPS_PROXY || process.env.HTTP_PROXY
    || process.env.https_proxy || process.env.http_proxy);
  res.json({
    proxyConfigured,
    nodeVersion: process.version,
  });
});

// ── Slice E/F1: Public plans endpoint (front-door, before routers) ──
// This direct handler is registered BEFORE the sub-routers so it always matches first.
// The billingRouter also has a /billing/plans route for sandbox DB reads,
// but that route is only reached when this handler calls next() (which it doesn't).
// MOCK mode: returns in-memory catalogue immediately.
// SANDBOX mode: this handler delegates to the billingRouter via next().
app.get('/api/billing/plans', (req, res, next) => {
  const paymentMode = (process.env.PAYMENT_MODE || 'mock') as string;
  if (paymentMode === 'alipay_sandbox') {
    // Delegate to billingRouter for DB read
    next();
    return;
  }
  // Mock: return in-memory catalogue (matches Slice E contract)
  res.json({
    plans: [
      { id: 'free', name: 'Free', nameZh: '免费版', priceCny: 0, quotaPerCycle: 20, cycleDescription: '每滚动 7 天', cycleDays: 7, features: ['每 7 天 20 次完整生成', '5 类港式平台文案', '质量审核与诊断', '消费者反馈模拟', '最多 10 条收藏', '最新 15 条生成历史'] },
      { id: 'pro', name: 'Pro', nameZh: '专业版', priceCny: 19, quotaPerCycle: 250, cycleDescription: '每自然月', cycleDays: null, features: ['每自然月 250 次生成', 'Free 全部功能', '收藏与生成历史全部解锁', '优先模型队列', '更多消费者画像', '高级品牌档案'] },
    ],
    paymentMode,
    isMock: true,
  });
});

app.use('/api', generateRouter);
app.use('/api', parsePersonasRouter);
app.use('/api', modifyRouter);
app.use('/api', quickCheckRouter);
app.use('/api', calendarRouter);
app.use('/api', inspirationRouter);
app.use('/api', competitorRouter);
app.use('/api', meRouter);
app.use('/api', checkInRouter);
app.use('/api', billingRouter);
app.use('/api', generationsRouter);
app.use('/api', syncRouter);
app.use('/api', feedbackRouter);
app.use('/api', caseLibraryRouter);
app.use('/api/admin', adminRouter);

// CORS reject → 403 JSON (avoid Express default 500 for "Not allowed by CORS")
app.use((err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.message === 'Not allowed by CORS') {
    if (!res.headersSent) {
      res.status(403).json({ error: 'Origin not allowed' });
    }
    return;
  }
  next(err);
});

export default app;
