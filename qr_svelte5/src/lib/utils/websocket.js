// @ts-nocheck
import { globals } from '$lib/stores/+stores.svelte.js';

export const useWebSocket = (api, getVrType) => {
  let ws = null;
  let intervalId = null;
  let reconnectTimeoutId = null;
  let responseTimeoutId = null;
  let reconnectAttempt = 0;
  let shouldReconnect = false;
  let listenersAttached = false;

  const POLL_INTERVAL_MS = 5000;
  const RESPONSE_TIMEOUT_MS = 15000;
  const MAX_RECONNECT_DELAY_MS = 30000;

  const clearPolling = () => {
      if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
      }

      if (responseTimeoutId) {
          clearTimeout(responseTimeoutId);
          responseTimeoutId = null;
      }
  };

  const clearReconnectTimeout = () => {
      if (reconnectTimeoutId) {
          clearTimeout(reconnectTimeoutId);
          reconnectTimeoutId = null;
      }
  };

  const requestClients = (socket = ws) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
          return;
      }

      socket.send(JSON.stringify({
          type: getVrType,
      }));

      // A browser can keep a half-open WebSocket after sleep or a network change.
      // If the server stops answering, close it and let the reconnect logic recover.
      if (!responseTimeoutId) {
          responseTimeoutId = setTimeout(() => {
              responseTimeoutId = null;
              if (socket === ws && socket.readyState === WebSocket.OPEN) {
                  socket.close(4000, 'Server response timeout');
              }
          }, RESPONSE_TIMEOUT_MS);
      }
  };

  const scheduleReconnect = () => {
      if (!shouldReconnect || reconnectTimeoutId) {
          return;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
          globals.set('clientsError', 'No network connection');
          return;
      }

      const delay = Math.min(1000 * (2 ** reconnectAttempt), MAX_RECONNECT_DELAY_MS);
      reconnectAttempt += 1;

      reconnectTimeoutId = setTimeout(() => {
          reconnectTimeoutId = null;
          openSocket();
      }, delay);
  };

  const openSocket = () => {
      if (!shouldReconnect) {
          return;
      }

      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
          requestClients(ws);
          return;
      }

      clearReconnectTimeout();
      clearPolling();

      let socket;
      try {
          socket = new WebSocket(api);
      } catch (error) {
          console.error('WebSocket connection failed:', error);
          globals.set('clientsError', 'Connection error');
          globals.set('isClientsLoading', false);
          scheduleReconnect();
          return;
      }
      ws = socket;
      globals.set('socket', socket);

      socket.onopen = () => {
          if (socket !== ws) {
              return;
          }

          reconnectAttempt = 0;
          globals.set('clientsError', null);
          requestClients(socket);
          intervalId = setInterval(() => requestClients(socket), POLL_INTERVAL_MS);
      };

      socket.onmessage = (msg) => {
          if (socket !== ws) {
              return;
          }

          if (responseTimeoutId) {
              clearTimeout(responseTimeoutId);
              responseTimeoutId = null;
          }

          try {
              const result = JSON.parse(msg.data);

              if (result?.type === 'vrOverview') {
                  const waiting = Array.isArray(result.waiting) ? result.waiting : [];
                  globals.set('vrOverview', {
                      ...result,
                      waiting,
                      watching: Array.isArray(result.watching) ? result.watching : [],
                      offline: Array.isArray(result.offline) ? result.offline : [],
                  });
                  // Keep the existing clients contract for pages that only need
                  // glasses currently available for selection.
                  globals.set('clients', waiting);
              } else if (Array.isArray(result)) {
                  globals.set('clients', result);
              } else {
                  throw new Error('Unexpected WebSocket response');
              }

              globals.set('isClientsLoading', false);
              globals.set('clientsError', null);
          } catch (error) {
              console.error('WebSocket message parse error:', error);
              globals.set('clientsError', 'Failed to parse server response');
          }
      };

      socket.onerror = (err) => {
          if (socket !== ws) {
              return;
          }

          console.error('WebSocket error:', err);
          globals.set('clientsError', 'Connection error');
          globals.set('isClientsLoading', false);
      };

      socket.onclose = () => {
          if (socket !== ws) {
              return;
          }

          clearPolling();
          ws = null;
          globals.set('socket', null);
          globals.set('clientsError', 'Connection closed');
          globals.set('isClientsLoading', false);
          scheduleReconnect();
      };
  };

  const refreshOnResume = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
          return;
      }

      if (ws && ws.readyState === WebSocket.OPEN) {
          requestClients(ws);
      } else if (shouldReconnect) {
          clearReconnectTimeout();
          openSocket();
      }
  };

  const attachResumeListeners = () => {
      if (listenersAttached || typeof window === 'undefined') {
          return;
      }

      window.addEventListener('online', refreshOnResume);
      window.addEventListener('focus', refreshOnResume);
      document.addEventListener('visibilitychange', refreshOnResume);
      listenersAttached = true;
  };

  const detachResumeListeners = () => {
      if (!listenersAttached || typeof window === 'undefined') {
          return;
      }

      window.removeEventListener('online', refreshOnResume);
      window.removeEventListener('focus', refreshOnResume);
      document.removeEventListener('visibilitychange', refreshOnResume);
      listenersAttached = false;
  };

  const connect = () => {
      shouldReconnect = true;
      attachResumeListeners();
      openSocket();
  };

  const disconnect = () => {
      shouldReconnect = false;
      clearReconnectTimeout();
      clearPolling();
      detachResumeListeners();

      if (ws) {
          const socket = ws;
          ws = null;
          socket.close(1000, 'Page closed');
      }

      globals.set('socket', null);
  };

  return {
      connect,
      disconnect
  };
};
