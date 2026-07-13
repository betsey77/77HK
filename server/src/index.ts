import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ── Load .env BEFORE any other module initializes ──
// Static ESM imports hoist above this code, but all our app imports
// are loaded via dynamic import() below so dotenv fires first.

function loadEnv() {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const envPath = resolve(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      console.log(`[env] loaded ${envPath}`);
    }
  } catch {
    const envPath = resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      console.log(`[env] loaded ${envPath}`);
    }
  }
}

loadEnv();

// Dynamic import — guarantees dotenv runs before app module tree initializes
const app = (await import('./app.js')).default;

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
