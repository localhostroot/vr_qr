import WebSocket from 'ws';

const ip_regex = /^::ffff:[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/

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
          lastReq: null
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
          lastReq: null
        });
  
        ids.push({
          id: userId,
          location: location,
        });
        console.log(`Клиент добавлен: `, clients[clients.length - 1]);
      }
      ws.send(res);
    } else {
      console.error("Не удалось получить userId или location. Клиент не добавлен.");
    }
};


const handleStartVideo = (client, currentVideoId, details, ws) => {
    const playbackPosition = details.playbackPosition || 0;
    if (client.currentVideoId !== currentVideoId) {
        handleVideoChange(client, currentVideoId);
    }
    handlePlayback(client, details, playbackPosition);
};

const handleVideoChange = (client, currentVideoId) => {
    if (client.currentVideoId) {
        console.log(`Смена фильма: заканчиваем ${client.currentVideoId}`);
        sendStatistics(client.id, client.location, client.currentVideoId);
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
        console.log(`увеличиваем счетчик: ${client.playbackTimeCounter}`);
    } else {
        console.log("Video не идет.");
    }
};

const handleEndVideo = (client) => {
    if (client.currentVideoId) {
        console.log(`Фильм ${client.currentVideoId} завершен.`);
        console.log(`playbackTimeCounter: ${client.playbackTimeCounter}`);
        client.statistics.push({
            videoId: client.currentVideoId,
            totalPlayTime: client.playbackTimeCounter,
            lastPlaybackPosition: client.lastPlaybackPosition,
        });
        finishVideo(client)
    }
};

const finishVideo = (client) => {
    console.log(`Отправляем статистику: ${client.currentVideoId}, id ${client.id}, location ${client.location}`);
    sendStatistics(client.id, client.location, client.currentVideoId);
    client.currentVideoId = null;
    client.playbackTimeCounter = 0;
    client.lastPlaybackPosition = 0;
};
export {handleStartVideo, handleEndVideo}


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

  if (foundClient) {
      console.log(`Найден клиент с location: ${foundClient.location} и ID: ${foundClient.id}`);

      if (!foundClient.params) foundClient.params = {};
      if (!foundClient.playbackTimeCounter) foundClient.playbackTimeCounter = 0;
      if (!foundClient.lastPlaybackPosition) foundClient.lastPlaybackPosition = 0;
      if (!foundClient.currentVideoId) foundClient.currentVideoId = null;
      if (!foundClient.statistics) foundClient.statistics = [];
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
                  foundClient.pendingQueue.shift();

                  const msg = JSON.stringify({
                      type: 'videoChangeRequested',
                      data: {
                          videoId: pendingQueue,
                          allowUserInput: true,
                      }
                  });

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
          `Клиент с location: ${ws.location}, ID: ${ws.userId}.`
      );
  }
};


export const VRHandler = {
    'login':		onLogin,
    'updateState':		onUpdateState,
}