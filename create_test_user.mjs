import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

function readEnvFile(path) {
  if (!fs.existsSync(path)) return {};
  const content = fs.readFileSync(path, 'utf8');
  return Object.fromEntries(
    content
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => {
        const idx = l.indexOf('=');
        return [l.slice(0, idx), l.slice(idx + 1)];
      })
  );
}

const env = readEnvFile('.env.local');
const SUPABASE_URL = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local or environment');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const args = process.argv.slice(2);
const email = args[0] || 'test+dev@local.test';
const password = args[1] || 'Password123!';

console.log(`Creating Supabase user ${email}`);

try {
  const run = async () => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      console.error('Error creating user:', error.message || error);
      process.exit(1);
    }
    console.log('Create result:', data);
    console.log('If your Supabase project requires email confirmation, check the dashboard to confirm the user.');
  };
  await run();
} catch (err) {
  console.error('Unexpected error:', err);
  process.exit(1);
}
