import { globals } from '$lib/stores/+stores.svelte.js';

export const useWebSocket = (api, getVrType) => {
  let ws = null;
  let intervalId = null;

  const connect = () => {
      if (ws) {
          ws.close();
      }

      ws = new WebSocket(api);
      globals.set('socket', ws);

      const getVr = () => {
          if (ws && ws.readyState === WebSocket.OPEN) {
              const payload = JSON.stringify({
                  type: getVrType,
              });
              ws.send(payload);
          }
      };

      ws.onopen = () => {
          getVr();
          intervalId = setInterval(getVr, 5000);
      };

      ws.onmessage = (msg) => {
          try {
              const result = JSON.parse(msg.data);
              globals.set('clients', result);
              globals.set('isClientsLoading', false);
              globals.set('clientsError', null);
          } catch (error) {
              console.error('WebSocket message parse error:', error);
              globals.set('clientsError', 'Failed to parse server response');
          }
      };

      ws.onerror = (err) => {
          console.error('WebSocket error:', err);
          globals.set('clientsError', 'Connection error');
          globals.set('isClientsLoading', false);
      };

      ws.onclose = () => {
          if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
          }
      };
  };

  const disconnect = () => {
      if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
      }
      if (ws) {
          ws.close();
          ws = null;
      }
      globals.set('socket', null);
  };

  return {
      connect,
      disconnect
  };
};
