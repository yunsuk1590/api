import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export const supabaseAnon = createClient(config.supabaseUrl, config.supabaseAnonKey);

// Per-request client scoped to the caller's JWT so RLS policies apply as that user.
export function supabaseForToken(accessToken) {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}

export function extractBearerToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}
