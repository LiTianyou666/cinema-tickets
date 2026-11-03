import { request } from './api.js';

// server settings, requested once and kept in memory
let cachedConfig = null;

export async function getConfig() {
  if (cachedConfig !== null) {
    return cachedConfig;
  }

  cachedConfig = await request('/config', { auth: false });
  return cachedConfig;
}
