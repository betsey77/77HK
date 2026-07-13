import dotenv from 'dotenv';
import { resolve } from 'path';
import fs from 'fs';

// Load .env before any tests run
const envPath = resolve(process.cwd(), '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
// Also try relative to this file
const altPath = resolve(process.cwd(), '.env');
if (fs.existsSync(altPath)) {
  dotenv.config({ path: altPath });
}

// Set fallback values for tests if .env not available
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
}
if (!process.env.SUPABASE_PUBLISHABLE_KEY) {
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
}
