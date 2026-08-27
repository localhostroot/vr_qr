import WebSocket from 'ws';
import fs from 'fs/promises';
import path from 'path';
import {
  checkViewerFilmAccess,
  ensurePaidPlaybackSession,
  finalizePaidPlaybackSession,
  inheritClientPlayback,
  markPaidAuthorization,
  restoreClientPlayback,
  updateViewerPresenceTimeout,
  updatePaidPlaybackSession,
  verifyPaidAccess,
} from '../services/paidPlayback.js';

const ip_regex = /^::ffff:[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/

const PAYMENT_REQUIRED_MESSAGE = (
  'Для просмотра этого фильма оплатите его на странице покупки\n' +
  '(открывается через QR-код на очках)'
);
const PAYMENT_CHECK_FAILED_MESSAGE = (
  'Не удалось проверить оплату. Проверьте соединение и повторите попытку.'
);
const PAYMENT_BLOCK_FALLBACK_MS = 3_000;

const isVideoIdPresent = (videoId) => (
  videoId !== null && videoId !== undefined && videoId !== ''
);

const isSameVideo = (firstVideoId, secondVideoId) => (
  isVideoIdPresent(firstVideoId) &&
  isVideoIdPresent(secondVideoId) &&
  String(firstVideoId) === String(secondVideoId)
);

const normalizeVideoQueue = (queue) => {
  const normalizedQueue = [];

  for (const videoId of Array.isArray(queue) ? queue : []) {
    if (
      isVideoIdPresent(videoId) &&
      !normalizedQueue.some(existingVideoId => isSameVideo(existingVideoId, videoId))
    ) {
      normalizedQueue.push(videoId);
    }
  }

  return normalizedQueue;
};

const queueHasVideo = (queue, videoId) => (
  Array.isArray(queue) && queue.some(queuedVideoId => isSameVideo(queuedVideoId, videoId))
);

const removeVideoFromQueue = (queue, videoId) => (
  normalizeVideoQueue(queue).filter(queuedVideoId => !isSameVideo(queuedVideoId, videoId))
);

const normalizeClientQueues = (client) => {
  client.queue = normalizeVideoQueue(client.queue);
  client.pendingQueue = normalizeVideoQueue(client.pendingQueue);
};

const isVideoAlreadyRequested = (client, videoId) => (
  isSameVideo(client.currentVideoId, videoId) ||
  queueHasVideo(client.queue, videoId) ||
  queueHasVideo(client.pendingQueue, videoId)
);

// Function to format time duration as hh:mm:ss
const formatUptime = (milliseconds) => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const getClientSummary = (client) => {
  let currentUptime = '00:00:00';
  if (client.connectionTimestamp) {
    currentUptime = formatUptime(Date.now() - client.connectionTimestamp);
  }

  const queue = normalizeVideoQueue(client.queue);
  const currentVideoId = isVideoIdPresent(client.currentVideoId)
    ? client.currentVideoId
    : queue[0] ?? null;

  return {
    location: client.location || null,
    id: client.id || null,
    activity: Number.isFinite(client.activity) ? client.activity : null,
    userPresent: Boolean(client.userPresent),
    currentVideoId,
    playbackPosition: Number.isFinite(client.playbackPosition) ? client.playbackPosition : null,
    duration: Number.isFinite(client.currentVideoDuration) ? client.currentVideoDuration : null,
    isPlaying: Boolean(client.isPlaying),
    currentUptime,
    connectedAt: client.connectionTimestamp
      ? new Date(client.connectionTimestamp).toISOString()
      : null,
    lastSeenAt: client.lastSeenAt
      ? new Date(client.lastSeenAt).toISOString()
      : null,
  };
};

const sortClients = (clients) => clients.sort((a, b) => (
  `${a.location}:${a.id}`.localeCompare(`${b.location}:${b.id}`, undefined, { numeric: true })
));

// Function to save uptime to JSON file
const saveUptime = async (location, id, uptime) => {
  try {
    const uptimeFilePath = path.join(process.cwd(), 'uptime.json');
    let uptimeData = {};
    
    // Try to read existing data
    try {
      const existingData = await fs.readFile(uptimeFilePath, 'utf8');
      uptimeData = JSON.parse(existingData);
    } catch (error) {
      // File doesn't exist or is invalid, start with empty object
      console.log('Creating new uptime.json file');
    }
    
    const clientKey = `${location}_${id}`;
    if (!uptimeData[clientKey]) {
      uptimeData[clientKey] = [];
    }
    
    uptimeData[clientKey].push(uptime);
    
    await fs.writeFile(uptimeFilePath, JSON.stringify(uptimeData, null, 2));
    console.log(`Uptime saved for ${clientKey}: ${uptime}`);
  } catch (error) {
    console.error('Error saving uptime:', error);
  }
};




const onGetVr = (ws, req, payload, clients, ids) => {
  console.log("Получен запрос на получение всех клиентов");

  function getCircularReplacer() {
    const seen = new WeakSet();
    return (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return;
        }
        seen.add(value);
      }
      return value;
    };
  }

  const clientsCopy = JSON.parse(JSON.stringify(clients, getCircularReplacer()));

  const simplifiedClients = clientsCopy.map(client => {
    if (!client || !Array.isArray(client.queue) || client.queue.length !== 0) return null;

    // Calculate current uptime
    let currentUptime = '00:00:00';
    if (client.connectionTimestamp) {
      const currentTime = Date.now();
      const uptimeMs = currentTime - client.connectionTimestamp;
      currentUptime = formatUptime(uptimeMs);
    }

    return {
      location: client.location || null,
      id: client.id || null,
      currentUptime: currentUptime
    };
  }).filter(client => client !== null);

  ws.send(JSON.stringify(simplifiedClients));
};

const onGetVrOverview = async (ws, req, payload, clients, ids, presenceHistory) => {
  const waiting = [];
  const watching = [];

  for (const client of clients) {
    const summary = getClientSummary(client);
    const isWatchingOrStarting = client.activity === 1 || isVideoIdPresent(summary.currentVideoId);

    if (isWatchingOrStarting) {
      watching.push(summary);
    } else {
      waiting.push(summary);
    }
  }

  const offlineResult = presenceHistory
    ? await presenceHistory.getOfflineForCurrentWindow(clients)
    : { offline: [], window: null };

  ws.send(JSON.stringify({
    type: 'vrOverview',
    serverTime: new Date().toISOString(),
    serviceWindow: offlineResult.window,
    waiting: sortClients(waiting),
    watching: sortClients(watching),
    offline: offlineResult.offline,
  }));
};

const onGetClient = (ws, req, payload, clients) => {
  const ipv4 = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const { location, clientId } = payload;

  if (!location || !clientId) {
      console.warn(`Нет такого клиента.`);
      return ws.send(JSON.stringify({
          error: "Нет локации или id"
      }));
  }

  const client = clients.find(client => client.location === location && client.id === clientId);

  if (client) {
      console.log(`getClient: Вовращаем данные клиента ${clientId} локации ${location}.`);
      if (client.lastReq !== ipv4) { 
          console.log(`WebSocket клиента ${clientId} изменился. Очистка данных.`);
          client.pendingQueue = null;
          client.currentVideoId = null;
          client.playbackPosition = null;
          client.lastReq = ipv4;   
      }

      const clientData = {
          pendingQueue: client.pendingQueue || null,
          activity: client.activity || null,
          currentVideoId: client.currentVideoId || null,
          playbackPosition: client.playbackPosition || null
      };

      ws.send(JSON.stringify(clientData));
  } else {
      console.warn(`Клиент с локацией ${location} и номером ${clientId} не найден.`);
      ws.send(JSON.stringify({
          error: `Клиент с локацией ${location} и номером ${clientId} не найден.`
      }));
  }
};


const onGetVrList = (ws, req, payload, clients, ids) => {
  const location = payload.location;
  console.log("Запрошенная локация:", location)
  const clientsCopy = JSON.parse(JSON.stringify(clients, getCircularReplacer()));

  const filteredClients = clientsCopy.filter(client => client.location === location);

  ws.send(JSON.stringify(filteredClients));

  function getCircularReplacer() {
      const seen = new WeakSet();
      return (key, value) => {
          if (typeof value === "object" && value !== null) {
              if (seen.has(value)) {
                  return;
              }
              seen.add(value);
          }
          return value;
      };
  }
}

const onStop = (ws, req, payload, clients) => {
  const msg = JSON.stringify({
      type: 'videoStopRequested'
  });
  const cl = clients.find(cl => cl.id == payload.clientId && cl.location === payload.location); 
  if (cl) {
      normalizeClientQueues(cl);
      const videoId = isVideoIdPresent(payload.videoId) ? payload.videoId : cl.currentVideoId;
      cl.queue = removeVideoFromQueue(cl.queue, videoId);
      cl.pendingQueue = removeVideoFromQueue(cl.pendingQueue, videoId);
      cl.stopRequestedVideoId = videoId;
      if (cl.missingVideoTimer) {
          clearTimeout(cl.missingVideoTimer);
          cl.missingVideoTimer = null;
      }
      cl.ws.send(msg);

      ws.send(JSON.stringify({
          type: 'requestResponse',
          success: true,
          message: 'Остановка видео запрошена'
      }));
  } else {
      console.log('Клиент не найден'); 
      ws.send(JSON.stringify({
          type: 'requestResponse',
          success: false,
          message: 'Клиент не найден'
      }));
  }
};

const onNotification = (ws, req, payload, clients) => {
  const msg = JSON.stringify({
      type: 'notification',
      data: {
          content: payload.noti || "EMPTY",
          scale: 1,
          duration: 2
      }
  });
  const cl = clients.find(cl => cl.id == payload.clientId && cl.location === payload.location); 
  if (cl) {
      cl.ws.send(msg);
  } else {
      console.log('Клиент не найден'); 
  }

};

const onSingleClientVideo = async (ws, req, payload, clients) => {
  const msg = JSON.stringify({
      type: 'videoChangeRequested',
      data: {
          videoId: payload.videoId,
          allowUserInput: true,
      }
  });
  const client = clients.find(client => client.id === payload.clientId && client.location === payload.location);

  if (client) {
      normalizeClientQueues(client);

      if (!isVideoIdPresent(payload.videoId)) {
          return ws.send(JSON.stringify({
              type: 'requestResponse',
              success: false,
              message: 'videoId не указан'
          }));
      }

      const paidAuthorization = payload.token
          ? await verifyPaidAccess(payload.token, payload.videoId)
          : null;
      const expectedViewerId = `${payload.location}/${payload.clientId}`;
      const paymentVerified = markPaidAuthorization(
          client,
          payload.videoId,
          paidAuthorization?.viewerId === expectedViewerId ? paidAuthorization : null,
      );

      if (!paymentVerified || client.paymentSessionResetPending) {
          return ws.send(JSON.stringify({
              type: 'requestResponse',
              success: false,
              paymentVerified: false,
              message: client.paymentSessionResetPending
                  ? 'Предыдущий сеанс завершается. Повторите через несколько секунд.'
                  : 'Оплата фильма не подтверждена'
          }));
      }

      if (isVideoAlreadyRequested(client, payload.videoId)) {
          return ws.send(JSON.stringify({
              type: 'requestResponse',
              success: true,
              duplicate: true,
              paymentVerified,
              message: 'Видео уже запущено или добавлено в очередь'
          }));
      }

      if (client.userPresent === false || client.activity === 2) {
          client.pendingQueue.unshift(payload.videoId);

          ws.send(JSON.stringify({
              type: 'requestResponse',
              success: true,
              paymentVerified,
              message: 'Видео добавлено в очередь'
          }));
      } else {
          client.queue.push(payload.videoId)
          client.ws.send(msg);
          ws.send(JSON.stringify({
              type: 'requestResponse',
              success: true,
              paymentVerified,
              message: 'Video началось'
          }));
      }
  } else {
      console.log(`Клиент не найден`);
      ws.send(JSON.stringify({
          type: 'requestResponse',
          success: false,
          message: `Клиент не найден`
      }));
  }
};

const onAddToQueue = (ws, req, payload, clients) => {
  const client = clients.find(client => client.id === payload.clientId && client.location === payload.location);
  if (client) {
      normalizeClientQueues(client);

      if (!isVideoIdPresent(payload.videoId)) {
          return ws.send(JSON.stringify({
              type: 'requestResponse',
              success: false,
              message: 'videoId не указан'
          }));
      }

      const duplicate = isVideoAlreadyRequested(client, payload.videoId);
      if (!duplicate) {
          client.pendingQueue.push(payload.videoId);
      }

      ws.send(JSON.stringify({
          type: 'requestResponse',
          success: true,
          duplicate,
          message: duplicate ? 'Видео уже добавлено в очередь' : 'Видео добавлено в очередь'
      }));
  } else {
    ws.send(JSON.stringify({
          type: 'requestResponse',
          success: false,
          message: `Клиент не найден`
      }));
  }
};

const onRemoveFromQueue = (ws, req, payload, clients) => {
  const client = clients.find(client => client.id === payload.clientId && client.location === payload.location);
  if (client) {
      if (Array.isArray(client.pendingQueue)) {
          client.pendingQueue = removeVideoFromQueue(client.pendingQueue, payload.videoId);

          ws.send(JSON.stringify({
              type: 'requestResponse',
              success: true,
              message: 'Видео удалено из очереди'
          }));
      } else {
           ws.send(JSON.stringify({
              type: 'requestResponse',
              success: false,
              message: 'pendingQueue не является массивом'
          }));
      }
  } else {
    ws.send(JSON.stringify({
          type: 'requestResponse',
          success: false,
          message: `Клиент не найден`
      }));
  }
};

const onCleanQueue = (ws, req, payload, clients) => {
  const client = clients.find(client => client.id === payload.clientId && client.location === payload.location);
  if (client) {
      client.pendingQueue = [];

      ws.send(JSON.stringify({
          type: 'requestResponse',
          success: true,
          message: 'Очередь полностью очищена'
      }));
  } else {
      ws.send(JSON.stringify({
          type: 'requestResponse',
          success: false,
          message: `Клиент не найден`
      }));
  }
};

const onMainMenu = (ws, req, payload, clients) => {
  const msg = JSON.stringify({
      type: 'folderChangeRequested',
      data: {
          folderId: 'base-folder',
          allowUserInput: true,
      }
  });
  const cl = clients.find(cl => cl.id == payload.clientId && cl.location === payload.location); 
  if (cl) {
      cl.ws.send(msg);
  } else {
      console.log('Клиент не найден'); 
  }
};

const onResetClient = (ws, req, payload, clients) => {
  const msg = JSON.stringify({
      type: "resetClient",
      data: {
          allowUnblock: "true",
          text: "Сброс",
          button: {
              label: "Продолжить использование"
          }
      }

  });
  const cl = clients.find(cl => cl.id == payload.clientId && cl.location === payload.location); 
  if (cl) {
      cl.ws.send(msg);
  } else {
    console.log('Клиент не найден');  
  }

};

const blockClient = (ws, text = PAYMENT_REQUIRED_MESSAGE) => {
    if (ws.readyState === WebSocket.OPEN) {
        const msg = JSON.stringify({
            type: "resetClient",
            data: {
                allowUnblock: "true",
                text,
                button: {
                    label: "Продолжить"
                }
            }
        });
        console.log("Заблокировано")
        ws.send(msg); 
    } else {
        console.error("WebSocket не открыт для отправки сообщений.");
    }
};

const showPendingPaymentBlock = (client, ws) => {
  const pendingBlock = client.pendingPaymentBlock;
  if (!pendingBlock) return false;

  if (client.missingVideoTimer) {
    clearTimeout(client.missingVideoTimer);
    client.missingVideoTimer = null;
  }

  client.pendingPaymentBlock = null;
  blockClient(ws, pendingBlock.message);
  return true;
};

const stopVideoBeforePaymentBlock = (client, ws, videoId, message) => {
  if (client.pendingPaymentBlock) return;

  client.pendingPaymentBlock = { videoId, message };
  client.stopRequestedVideoId = videoId;

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'videoStopRequested' }));
  }

  // Normally the headset reports its return to the intro scene and the block
  // is shown from updateState. Keep a fallback so a lost state update cannot
  // leave the viewer on a black screen indefinitely.
  client.missingVideoTimer = setTimeout(() => {
    showPendingPaymentBlock(client, ws);
  }, PAYMENT_BLOCK_FALLBACK_MS);
  client.missingVideoTimer.unref?.();
};

const fillQueue = (ws, req, payload, clients) => {
    console.log('Полученные данные в fillQueue:', payload);

    if (!payload || typeof payload !== 'object') {
        console.error('Payload не является объектом:', payload);
        return;
    }

    if (!payload.clientId) {
        console.error('userId отсутствует в payload:', payload);
        return;
    }

    if (!payload.location) {
        console.error('location отсутствует в payload:', payload);
        return;
    }

    const cl = clients.find(client => client.id == payload.clientId && client.location === payload.location);

    if (cl) {
        console.log(`Найден клиент ${cl.id}, обновляем очередь.`);
        cl.queue = normalizeVideoQueue(payload.queue);
        console.log(`${cl.id} очередь обновлена:`, cl.queue);
    } else {
        console.error(`Клиент с ID ${payload.clientId} и location ${payload.location} не найден среди:`, clients);
    }
};


export const APIHandler = {
	'stop':	onStop,
	'notification':	onNotification,
	'videoForClient': onSingleClientVideo,
  'addToQueue': onAddToQueue,
  'removeFromQueue': onRemoveFromQueue,
  'clean': onCleanQueue,
  'getVrList': onGetVrList,
  'getVr': onGetVr,
  'getVrOverview': onGetVrOverview,
  'mainMenu': onMainMenu,
  'reset': onResetClient,
  'fillQueue': fillQueue,
  'getClient': onGetClient,
}

const onLogin = async (ws, req, payload, clients, ids, presenceHistory) => {
  const ipv4 = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const locationAndId = payload.params.location;
  console.log(locationAndId);

  let location = null;
  let userId = null;

  if (locationAndId) {
    const parts = locationAndId.split(':');

    if (parts.length === 2) {
      location = parts[0];
      userId = parts[1];
    } else {
      console.warn("Неправильный формат locationAndId. Ожидается 'location:userId'");
    }
  } else {
    console.warn("locationAndId не предоставлен.");
  }

  const res = JSON.stringify({
    type: 'loginResponse',
    ok: true,
  });

  if (userId && location) {
    const existingClientIndex = clients.findIndex(client => client.id === userId && client.location === location);

    const previousClient = existingClientIndex !== -1
      ? clients[existingClientIndex]
      : null;
    const registeredState = {
        ws: ws,
        ip: ipv4,
        id: userId,
        location: location,
        activity: 2,
        pendingQueue: [],
        userPresent: false,
        isBlocked: false,
        queue: [],
        params: {},
        lastReq: null,
        connectionTimestamp: Date.now(),
        lastSeenAt: Date.now(),
        currentVideoId: null,
        playbackPosition: null,
        currentVideoDuration: null,
        isPlaying: false,
        activePlaybackSession: null,
        paidAuthorizations: {},
        pendingPaymentBlock: null,
      };

    if (previousClient) {
      inheritClientPlayback(registeredState, previousClient);
      clients[existingClientIndex] = registeredState;
      console.log(`Клиент перезаписан: `, clients[existingClientIndex]);
    } else {
      restoreClientPlayback(registeredState);
      clients.push(registeredState);

      ids.push({
        id: userId,
        location: location,
      });

      console.log(`Клиент добавлен:`);
      console.log(clients[clients.length - 1].ip);
      console.log(`${clients[clients.length - 1].location}:${clients[clients.length - 1].id}`);
    }

    const registeredClient = clients.find(
      (client) => client.id === userId && client.location === location
    );
    if (registeredClient && presenceHistory) {
      await presenceHistory.markOnline(registeredClient);
    }

    ws.send(res);
  } else {
    console.error("Не удалось получить userId или location. Клиент не добавлен.");
  }
};


  const handleStartVideo = async (client, currentVideoId, details, ws) => {
    const playbackPosition = details.playbackPosition || 0;

    normalizeClientQueues(client);

    if (isSameVideo(client.stopRequestedVideoId, currentVideoId)) {
      console.log(`Остановка фильма ${currentVideoId} уже запрошена. Запоздалое состояние воспроизведения пропущено.`);
      return;
    }

    if (!queueHasVideo(client.queue, currentVideoId)) {
      const access = await checkViewerFilmAccess(client, currentVideoId);
      if (!access.paid || client.paymentSessionResetPending) {
        handleMissingVideo(
          client,
          ws,
          currentVideoId,
          access.available ? PAYMENT_REQUIRED_MESSAGE : PAYMENT_CHECK_FAILED_MESSAGE,
        );
        return;
      }

      markPaidAuthorization(client, currentVideoId, access.authorization);
      client.queue.push(currentVideoId);
      handleVideoFound(client, currentVideoId);
    } else {
      handleVideoFound(client, currentVideoId);
    }
  
    if (client.currentVideoId !== currentVideoId) {
      await handleVideoChange(client, currentVideoId);
    }

    if (details.isPlaying) {
      ensurePaidPlaybackSession(client, currentVideoId);
    }

    handlePlayback(client, details, playbackPosition);
  };
  
  const handleMissingVideo = (client, ws, currentVideoId, message) => {
    stopVideoBeforePaymentBlock(client, ws, currentVideoId, message);
  };
  
  const handleVideoFound = (client, currentVideoId) => {
    if (client.missingVideoTimer !== null) {
      console.log(`Фильм ${currentVideoId} найден в очереди. Отмена блокировки.`);
      clearTimeout(client.missingVideoTimer);
      client.missingVideoTimer = null;
    }
  };
  
  const handleVideoChange = async (client, currentVideoId) => {
    if (client.currentVideoId) {
        console.log(`Смена фильма: заканчиваем ${client.currentVideoId}`);

        await finalizePaidPlaybackSession(client, 'video_changed');
        if (queueHasVideo(client.queue, client.currentVideoId)) {
            console.log(`Удаляем фильм ${client.currentVideoId} из очереди.`);
            client.queue = removeVideoFromQueue(client.queue, client.currentVideoId);
        } else {
            console.log(`Фильм ${client.currentVideoId} не найден в очереди.`);
        }
        client.playbackTimeCounter = 0;
        client.lastPlaybackPosition = 0;
    }
    client.currentVideoId = currentVideoId;
    console.log(`Теперь воспроизводится фильм ${currentVideoId}`);
  };
  
  const handlePlayback = (client, details, playbackPosition) => {
    client.playbackPosition = playbackPosition;
    client.isPlaying = Boolean(details.isPlaying);

    const reportedDuration = Number(
      details.duration ?? details.videoDuration ?? details.totalDuration
    );
    if (Number.isFinite(reportedDuration) && reportedDuration > 0) {
      client.currentVideoDuration = reportedDuration;
    }

    updatePaidPlaybackSession(client, details);

    console.log(`${details.isPlaying}`);
    if (details.isPlaying) {
      client.playbackTimeCounter += 1;
      client.lastPlaybackPosition = playbackPosition;
      console.log(`playbackTimeCounter iувеличен: ${client.playbackTimeCounter}`);
    } else {
      console.log("видео не играет");
    }
  };
  
  const handleEndVideo = async (client) => {
    if (client.missingVideoTimer) {
        clearTimeout(client.missingVideoTimer);
        client.missingVideoTimer = null;
    }

    const wasStopRequested = isVideoIdPresent(client.stopRequestedVideoId);
    if (wasStopRequested) {
        client.queue = removeVideoFromQueue(client.queue, client.stopRequestedVideoId);
        client.pendingQueue = removeVideoFromQueue(client.pendingQueue, client.stopRequestedVideoId);
        client.stopRequestedVideoId = null;
    }

    if (client.currentVideoId) {
        console.log(`Фильм ${client.currentVideoId} завершен.`);
        console.log(`playbackTimeCounter: ${client.playbackTimeCounter}`);
        const isInQueue = queueHasVideo(client.queue, client.currentVideoId);
        console.log(`isInQueue: ${isInQueue}`);
        if (isInQueue) {
            console.log(`Удаляем фильм ${client.currentVideoId} из очереди.`);
            client.queue = removeVideoFromQueue(client.queue, client.currentVideoId);
        } else {
            console.log(`Фильм ${client.currentVideoId} не найден в очереди.`);
        }
    await finalizePaidPlaybackSession(
      client,
      wasStopRequested ? 'stopped' : 'playback_ended',
    );
    client.currentVideoId = null;
    client.playbackPosition = null;
    client.currentVideoDuration = null;
    client.isPlaying = false;
    client.playbackTimeCounter = 0;
    client.lastPlaybackPosition = 0;
    }
  };

  
  const onUpdateState = async (ws, req, payload, clients, ids, presenceHistory) => {
    const ipv4 = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log(`updateState: запрос от клиента с IP ${ipv4}`);
    console.log("Полученные параметры:", payload.params);
    let foundClient = null;
    for (const client of clients) {
      if (client.location === ws.location && client.id === ws.userId) {
        foundClient = client;
        break;
      }
    }

    console.log("Нашли клиента:");
    console.log(foundClient?.ip);
    console.log(`${foundClient?.location}:${foundClient?.id}`);

    if (foundClient) {
      console.log(`Найден клиент с location: ${foundClient.location} и ID: ${foundClient.id}`);
      if (!foundClient.params) foundClient.params = {};
      if (!foundClient.playbackTimeCounter) foundClient.playbackTimeCounter = 0;
      if (!foundClient.lastPlaybackPosition) foundClient.lastPlaybackPosition = 0;
      if (!foundClient.currentVideoId) foundClient.currentVideoId = null;
      if (!foundClient.statistics) foundClient.statistics = [];
      normalizeClientQueues(foundClient);
      if (!foundClient.missingVideoTimer) foundClient.missingVideoTimer = null;
      if (!foundClient.userPresent) foundClient.userPresent = false;

      if (!foundClient.isProcessing) {
        foundClient.isProcessing = true;

        try {
          const currentActivity = payload.params.activity;
          const details = payload.params.details || {};
          foundClient.activity = currentActivity;
          foundClient.userPresent = payload.params.userPresent;
          foundClient.lastSeenAt = Date.now();
          updateViewerPresenceTimeout(foundClient, foundClient.userPresent);
          console.log(`Обновлен activity клиента ${foundClient.id}: ${currentActivity}, userPresent: ${foundClient.userPresent}`);

          if (currentActivity !== 1 && foundClient.pendingPaymentBlock) {
              await handleEndVideo(foundClient);
              showPendingPaymentBlock(foundClient, ws);
          } else if (currentActivity === 0 && foundClient.pendingQueue && Array.isArray(foundClient.pendingQueue) && foundClient.pendingQueue.length > 0 && foundClient.userPresent === true) {
              const pendingQueue = foundClient.pendingQueue[0];
              foundClient.pendingQueue = removeVideoFromQueue(foundClient.pendingQueue, pendingQueue);

              if (isSameVideo(foundClient.currentVideoId, pendingQueue) || queueHasVideo(foundClient.queue, pendingQueue)) {
                  console.log(`Фильм ${pendingQueue} уже запущен или ожидает запуска. Повторный запуск пропущен.`);
              } else {
                  foundClient.queue.push(pendingQueue);

                  const msg = JSON.stringify({
                      type: 'videoChangeRequested',
                      data: {
                          "videoId": pendingQueue,
                          "allowUserInput": true,
                      }
                  });

                  console.log(msg);
                  foundClient.ws.send(msg);
                  console.log(`Отправлено сообщение videoChangeRequested для videoId ${pendingQueue}`);
              }

          } else if (currentActivity === 1) {
              const currentVideoId = details.videoId;
              await handleStartVideo(foundClient, currentVideoId, details, ws);
          } else {
              await handleEndVideo(foundClient);
          }

          if (presenceHistory) {
            await presenceHistory.markOnline(foundClient);
          }
      } catch (error) {
          console.error("Ошибка при обработке:", error);
      } finally {
          foundClient.isProcessing = false;
      }
  } else {
      console.warn(`Клиент с location: ${foundClient.location} и ID: ${foundClient.id} уже обрабатывается.`);
  }
} else {
  console.warn(
      `Клиент с location: ${ws.location}, ID: ${ws.userId} не найден.`
  );
}
};


export const VRHandler = {
	'login':		onLogin,
	'updateState':		onUpdateState,
}






