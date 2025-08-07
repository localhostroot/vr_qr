import WebSocket from 'ws';
import fs from 'fs/promises';
import path from 'path';

const ip_regex = /^::ffff:[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/

// Function to format time duration as hh:mm:ss
const formatUptime = (milliseconds) => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

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

const onStop = (ws, req, payload, clients, queues) => {
  const msg = JSON.stringify({
      type: 'videoStopRequested'
  });
  const cl = clients.find(cl => cl.id == payload.clientId && cl.location === payload.location); 
  const queueIndex = queues.findIndex(queue => queue.id == payload.clientId);

  if (queueIndex !== -1) {
      queues[queueIndex].queue = [];
  }
  if (cl) {
      cl.ws.send(msg);
  } else {
      console.log('Клиент не найден'); 
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

const onSingleClientVideo = (ws, req, payload, clients) => {
  const msg = JSON.stringify({
      type: 'videoChangeRequested',
      data: {
          videoId: payload.videoId,
          allowUserInput: true,
      }
  });
  const client = clients.find(client => client.id === payload.clientId && client.location === payload.location);

  if (client) {
      if (client.userPresent === false || client.activity === 2) {
          if (!Array.isArray(client.pendingQueue)) {
              client.pendingQueue = [];
          }
          client.pendingQueue.unshift(payload.videoId);

          ws.send(JSON.stringify({
              type: 'requestResponse',
              success: true,
              message: 'Видео добавлено в очередь'
          }));
      } else {
          client.queue.push(payload.videoId)
          client.ws.send(msg);
          ws.send(JSON.stringify({
              type: 'requestResponse',
              success: true,
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
      client.pendingQueue.push(payload.videoId);

      ws.send(JSON.stringify({
          type: 'requestResponse',
          success: true,
          message: 'Видео добавлено в очередь'
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
          client.pendingQueue = client.pendingQueue.filter(videoId => videoId !== payload.videoId);

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

const blockClient = (ws) => {
    if (ws.readyState === WebSocket.OPEN) {
        const msg = JSON.stringify({
            type: "resetClient",
            data: {
                allowUnblock: "true",
                text: "Запустите фильм с телефона",  
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
        cl.queue = payload.queue;
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
  'mainMenu': onMainMenu,
  'reset': onResetClient,
  'fillQueue': fillQueue,
  'getClient': onGetClient,
}

const onLogin = async (ws, req, payload, clients, ids) => {
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

    if (existingClientIndex !== -1) {
      clients[existingClientIndex] = {
        ws: ws,
        ip: ipv4,
        id: userId,
        location: location,
        isBlocked: false,
        activity: 2,
        pendingQueue: null,
        userPresent: false,
        queue: [],
        params: {},
        lastReq: null,
        connectionTimestamp: Date.now()
      };
      console.log(`Клиент перезаписан: `, clients[existingClientIndex]);
    } else {
      clients.push({
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
        connectionTimestamp: Date.now()
      });

      ids.push({
        id: userId,
        location: location,
      });

      console.log(`Клиент добавлен:`);
      console.log(clients[clients.length - 1].ip);
      console.log(`${clients[clients.length - 1].location}:${clients[clients.length - 1].id}`);
    }
    ws.send(res);
  } else {
    console.error("Не удалось получить userId или location. Клиент не добавлен.");
  }
};


  const handleStartVideo = (client, currentVideoId, details, ws) => {
    const playbackPosition = details.playbackPosition || 0;
  

    if (!client.queue.includes(currentVideoId)) {
      handleMissingVideo(client, currentVideoId, ws);
      return;
    } else {
      handleVideoFound(client, currentVideoId);
    }
  
    if (client.currentVideoId !== currentVideoId) {
      handleVideoChange(client, currentVideoId);
    }
  
    handlePlayback(client, details, playbackPosition);
  };
  
  const handleMissingVideo = (client, currentVideoId, ws) => {
    if (client.missingVideoTimer === null) {
      console.log(`Фильм ${currentVideoId} отсутствует в очереди клиента. Отсчет 5 секунд перед блокировкой.`);
      client.missingVideoTimer = setTimeout(() => {
        console.log(`Время на просмотр истекло. Блокировка устройства.`);
        blockClient(ws);
        client.missingVideoTimer = null;
      }, 5000);
    }
  };
  
  const handleVideoFound = (client, currentVideoId) => {
    if (client.missingVideoTimer !== null) {
      console.log(`Фильм ${currentVideoId} найден в очереди. Отмена блокировки.`);
      clearTimeout(client.missingVideoTimer);
      client.missingVideoTimer = null;
    }
  };
  
  const handleVideoChange = (client, currentVideoId) => {
    if (client.currentVideoId) {
        console.log(`Смена фильма: заканчиваем ${client.currentVideoId}`);

        sendStatistics(client.id, client.location, client.currentVideoId);
        const index = client.queue.indexOf(client.currentVideoId);
        if (index !== -1) {
            console.log(`Удаляем фильм ${client.currentVideoId} из очереди.`);
            client.queue.splice(index, 1);
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
    console.log(`${details.isPlaying}`);
    if (details.isPlaying) {
      client.playbackTimeCounter += 1;
      client.lastPlaybackPosition = playbackPosition;
      console.log(`playbackTimeCounter iувеличен: ${client.playbackTimeCounter}`);
    } else {
      console.log("видео не играет");
    }
  };
  
  const handleEndVideo = (client) => {
    if (client.currentVideoId) {
        console.log(`Фильм ${client.currentVideoId} завершен.`);
        console.log(`playbackTimeCounter: ${client.playbackTimeCounter}`);
        const index = client.queue.indexOf(client.currentVideoId);
        console.log(`index: ${index}`);
        if (index !== -1) {
            console.log(`Удаляем фильм ${client.currentVideoId} из очереди.`);
            client.queue.splice(index, 1);
        } else {
            console.log(`Фильм ${client.currentVideoId} не найден в очереди.`);
        }
    sendStatistics(client.id, client.location, client.currentVideoId);
    client.currentVideoId = null;
    client.playbackTimeCounter = 0;
    client.lastPlaybackPosition = 0;
    }
  };

  
  const sendStatistics = async (deviceId, locationName, videoId) => {
    try {
      const response = await fetch('https://stats.4-neba.ru/api/api/update_statistics/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: deviceId,
          location_name: locationName,
          video_id: videoId,
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP error! status: ${response.status}, ${JSON.stringify(errorData)}`);
      }
  
      const data = await response.json();
      console.log('Статистика отправлена:', data);
    } catch (error) {
      console.error('Ошибка при отправке статистики:', error.message);
    }
  };

  const onUpdateState = async (ws, req, payload, clients, blockClient) => {
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
      if (!foundClient.queue) foundClient.queue = [];
      if (!foundClient.missingVideoTimer) foundClient.missingVideoTimer = null;
      if (!foundClient.userPresent) foundClient.userPresent = false;

      if (!foundClient.isProcessing) {
        foundClient.isProcessing = true;

        try {
          const currentActivity = payload.params.activity;
          const details = payload.params.details || {};
          foundClient.activity = currentActivity;
          foundClient.userPresent = payload.params.userPresent;
          console.log(`Обновлен activity клиента ${foundClient.id}: ${currentActivity}, userPresent: ${foundClient.userPresent}`);

          if (currentActivity === 0 && foundClient.pendingQueue && Array.isArray(foundClient.pendingQueue) && foundClient.pendingQueue.length > 0 && foundClient.userPresent === true) {
              const pendingQueue = foundClient.pendingQueue[0];
              foundClient.queue.push(pendingQueue)
              foundClient.pendingQueue.shift();

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

          } else if (currentActivity === 1) {
              const currentVideoId = details.videoId;
              handleStartVideo(foundClient, currentVideoId, details, ws);
          } else {
              handleEndVideo(foundClient);
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






