import { createClient } from '@supabase/supabase-js';

let _client = null;

// Auto-initialize on module load if credentials exist
const _url = localStorage.getItem('sb_url');
const _key = localStorage.getItem('sb_key');
if (_url && _key) {
  _client = createClient(_url, _key);
}

export function initSupabase() {
  const url = localStorage.getItem('sb_url');
  const key = localStorage.getItem('sb_key');
  if (!url || !key) return null;
  if (!_client) _client = createClient(url, key);
  return _client;
}

export function getClient() { return _client; }

export function setCredentials(url, key) {
  localStorage.setItem('sb_url', url.trim());
  localStorage.setItem('sb_key', key.trim());
  _client = createClient(url.trim(), key.trim());
  return _client;
}

export function clearCredentials() {
  localStorage.removeItem('sb_url');
  localStorage.removeItem('sb_key');
  _client = null;
}

export function getCredentials() {
  return {
    url: localStorage.getItem('sb_url') || '',
    key: localStorage.getItem('sb_key') || '',
  };
}

export function isConfigured() {
  return !!(localStorage.getItem('sb_url') && localStorage.getItem('sb_key'));
}

// ── Auth helpers ─────────────────────────────────────────────────
export async function signIn(email, password) {
  return getClient()?.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return getClient()?.auth.signOut();
}

export function getSession() {
  return getClient()?.auth.getSession();
}

export function onAuthChange(callback) {
  return getClient()?.auth.onAuthStateChange(callback);
}
