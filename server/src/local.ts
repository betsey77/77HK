import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load .env before the app module tree initializes.
function loadEnv() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const envPaths = [...new Set([
    resolve(__dirname, '../.env'),
    resolve(__dirname, '../../.env'),
    resolve(process.cwd(), '.env'),
  ])];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      // Service-specific values win; later files only fill missing variables.
      dotenv.config({ path: envPath, override: false });
      console.log(`[env] loaded ${envPath}`);
    }
  }
}

loadEnv();

const app = (await import('./app.js')).default;
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
