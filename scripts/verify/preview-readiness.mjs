import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function envKeys(relativePath) {
  const keys = new Set();
  for (const line of fs.readFileSync(path.join(root, relativePath), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=(.*)$/);
    if (!match) continue;
    keys.add(match[1]);
    if (/SECRET|PRIVATE_KEY|ACCESS_TOKEN|API_KEY|SENDKEY/.test(match[1])) {
      assert(match[2].trim() === '', `${match[1]} must stay empty in .env.example`);
    }
  }
  return keys;
}

const client = readJson('client/vercel.json');
const server = readJson('server/vercel.json');

assert(
  client.rewrites?.some((rule) => rule.source === '/(.*)' && rule.destination === '/index.html'),
  'client SPA rewrite is missing',
);
assert(Array.isArray(server.regions) && server.regions.length === 1 && server.regions[0] === 'hnd1', 'server region must be hnd1');
assert(server.outputDirectory === 'public', 'server static placeholder directory must be public');
assert(fs.existsSync(path.join(root, 'server/public/.gitkeep')), 'server public placeholder is missing');
assert(server.functions?.['api/index.ts']?.maxDuration === 90, 'server Function must use a 90-second maximum duration');
assert(
  server.rewrites?.some((rule) => rule.source === '/api/:path*' && rule.destination === '/api/index'),
  'server API rewrite is missing',
);
assert(!('builds' in server) && !('routes' in server), 'legacy Vercel config is not allowed');

const appSource = fs.readFileSync(path.join(root, 'server/src/app.ts'), 'utf8');
assert(/export\s+default\s+app\s*;/.test(appSource), 'Express app must have a default export');
const functionSource = fs.readFileSync(path.join(root, 'server/api/index.ts'), 'utf8');
assert(/import\s+app\s+from\s+['"]\.\.\/src\/app\.js['"]/.test(functionSource), 'Vercel Function must import the Express app');
assert(/export\s+default\s+app\s*;/.test(functionSource), 'Vercel Function must export the Express app');

const modelPolicySource = fs.readFileSync(path.join(root, 'server/src/services/modelPolicy.ts'), 'utf8');
assert(modelPolicySource.includes("deepseek-v4-flash"), 'Preview must default to deepseek-v4-flash');
assert(modelPolicySource.includes("type: 'disabled'"), 'DeepSeek V4 thinking must be disabled');
assert(modelPolicySource.includes('REAL_MODEL_UNAVAILABLE'), 'Strict real-model failure code is missing');

const keys = envKeys('.env.example');
for (const required of [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_API_BASE_URL',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'ALLOWED_ORIGINS',
  'PAYMENT_MODE',
  'APP_FRONTEND_URL',
  'APP_API_URL',
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_MODEL',
  'REQUIRE_REAL_MODEL',
]) {
  assert(keys.has(required), `.env.example is missing ${required}`);
}

console.log('PASS client Vite SPA preview config');
console.log('PASS server Express hnd1 Function deployment');
console.log('PASS Express default export');
console.log('PASS preview environment-variable contract');
console.log('PASS strict DeepSeek V4 model contract');
console.log('PASS sensitive .env.example values remain empty');
