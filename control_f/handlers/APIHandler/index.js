import WebSocket from 'ws';

const ip_regex = /^::ffff:[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/



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
  

const onGetVr = (ws, req, payload, clients, ids) => {
    console.log("Получен запрос на получение всех клиентов, у которых activity != 1");

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

    const simplifiedClients = clientsCopy
        .filter(client => client && client.activity !== 1)
        .map(client => {
            if (!client) return null;

            return {
                location: client.location || null,
                id: client.id || null,
            };
        })
        .filter(client => client !== null);

    ws.send(JSON.stringify(simplifiedClients));
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
    const cl = clients.find(cl => cl.id === payload.clientId && cl.location === payload.location);
    const queueIndex = queues.findIndex(queue => queue.id === payload.clientId);

    if (queueIndex !== -1) {
        queues[queueIndex].queue = [];
    }
    if (cl) {
        cl.ws.send(msg);
    } else {
        console.log(с);
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
    const cl = clients.find(cl => cl.id === payload.clientId && cl.location === payload.location);
    if (cl) {
        cl.ws.send(msg);
    } else {
        console.log(`Клиент не найден`);
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
    const cl = clients.find(cl => cl.id === payload.clientId && cl.location === payload.location);
    if (cl) {
        cl.ws.send(msg);
    } else {
        console.log(`Клиент не найден`);
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
    const cl = clients.find(cl => cl.id === payload.clientId && cl.location === payload.location);
    if (cl) {
        cl.ws.send(msg);
    } else {
        console.log(`Клиент не найден`);
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
    'getClient': onGetClient,
}