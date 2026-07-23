import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

let anonClient = null;

// Created lazily (not at import time) so a missing SUPABASE_URL/SUPABASE_ANON_KEY
// doesn't crash the whole server on load — callers must check envError first.
export function getSupabaseAnon() {
  if (!anonClient) {
    anonClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
  }
  return anonClient;
}

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
