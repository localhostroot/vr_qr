import { browser } from '$app/environment';
import LOCAL_STORAGE_KEYS from '$lib/constants/localStorageKeys.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createUuid = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10).join(''),
  ].join('-');
};

/** @param {string | null | undefined} sessionId */
export const setViewerSessionId = (sessionId) => {
  if (!browser || !UUID_PATTERN.test(String(sessionId || ''))) return false;
  localStorage.setItem(LOCAL_STORAGE_KEYS.VIEWER_SESSION_ID, sessionId);
  return true;
};

export const getViewerSessionId = () => {
  if (!browser) return null;

  const existing = localStorage.getItem(LOCAL_STORAGE_KEYS.VIEWER_SESSION_ID);
  if (UUID_PATTERN.test(String(existing || ''))) return existing;

  const sessionId = createUuid();
  localStorage.setItem(LOCAL_STORAGE_KEYS.VIEWER_SESSION_ID, sessionId);
  return sessionId;
};
