import express from 'express';
import cors from 'cors';
import generateRouter from './routes/generate.js';
import parsePersonasRouter from './routes/parsePersonas.js';
import modifyRouter from './routes/modify.js';
import quickCheckRouter from './routes/quickCheck.js';
import calendarRouter from './routes/calendar.js';
import inspirationRouter from './routes/inspiration.js';
import competitorRouter from './routes/competitor.js';
import meRouter from './routes/me.js';
import generationsRouter from './routes/generations.js';
import syncRouter from './routes/sync.js';
import feedbackRouter from './routes/feedback.js';
import { billingRouter } from './routes/billing.js';
import adminRouter from './routes/admin.js';

const app = express();

app.use(cors());

// Body size limit: 1 MiB
const BODY_LIMIT_BYTES = 1_048_576;

// Body parser — manual for serverless compatibility
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') { next(); return; }
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
  res.json({
    status: 'ok',
    selfHostedConfigured: !!process.env.CANTONESE_API_URL,
    deepseekConfigured: !!process.env.DEEPSEEK_API_KEY,
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

// ── Slice E: Public plans endpoint ──
app.get('/api/billing/plans', (_req, res) => {
  res.json({
    plans: [
      { id: 'free', name: 'Free', nameZh: '免费版', priceCny: 0, quotaPerCycle: 20, cycleDescription: '每滚动 7 天', cycleDays: 7, features: ['每 7 天 20 次完整生成', '5 类港式平台文案', '质量审核与诊断', '消费者反馈模拟', '历史记录与收藏'] },
      { id: 'pro', name: 'Pro', nameZh: '专业版', priceCny: 19, quotaPerCycle: 400, cycleDescription: '每自然月', cycleDays: null, features: ['每自然月 400 次生成', 'Free 全部功能', '优先模型队列', '更多消费者画像', '高级品牌档案'] },
    ],
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
app.use('/api', generationsRouter);
app.use('/api', syncRouter);
app.use('/api', feedbackRouter);
app.use('/api', billingRouter);
app.use('/api', adminRouter);

export default app;
