import { APIHandler, VRHandler } from '../handlers/index.js'
const clients = []
const ids = []



export const APIController = (ws, req) => {
  const ipv4 = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  ws.on('message', (msg) => {

      const payload = JSON.parse(msg.toString());

      console.log('message payload');
      console.log(payload);

      const type = payload.type;
      if (type && type in APIHandler) {
          APIHandler[type](ws, req, payload, clients, ids);
      }
  });

  ws.on('close', () => {
      console.log(`Host ${ipv4} closed connection`); 
  });

  ws.on('error', (err) => {
      console.err(err);
  });
}

export const VRController = (ws, req) => {
  const ipv4 = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  ws.on("message", (msg) => {
    const payload = JSON.parse(msg.toString());
    const type = payload.type;
    ws.payload = payload;

    if (type === 'login' && payload.params && payload.params.location) {
      const locationAndId = payload.params.location;
      const [location, userId] = locationAndId.split(":");
      ws.location = location;
      ws.userId = userId;

      console.log(`Сохранен location для IP ${ipv4}: ${location}`);
      console.log(`Сохранен userId для IP ${ipv4}: ${userId}`);
    }

    if (type && type in VRHandler) {
      VRHandler[type](ws, req, payload, clients, ids);
    }
  });

  ws.on("close", () => {
    console.log(`Host ${ipv4} closed connection`);

    const closingLocation = ws.location;
    const closingUserId = ws.userId;

    if (closingLocation && closingUserId) {
      const clientIndex = clients.findIndex(
        (client) =>
          client.location === closingLocation &&
          client.id === closingUserId
      );

      if (clientIndex !== -1) {
        const userIdToRemove = clients[clientIndex].id;

        console.log(
          `Удаляем клиента с IP ${ipv4}, location ${closingLocation} и ID ${closingUserId}`
        );
        clients.splice(clientIndex, 1);

        const idIndex = ids.findIndex((idObj) => idObj.id === userIdToRemove);
        if (idIndex !== -1) {
          console.log(`Удаляем ID ${userIdToRemove} из массива ids`);
          ids.splice(idIndex, 1);
        }
      } else {
        console.warn(
          `Клиент с location: ${closingLocation} и ID ${closingUserId} не найден.`
        );
      }
    } else {
      console.warn("Не удалось получить location или userId из объекта ws.");
    }

    console.log(`Текущие клиенты: `, clients.map(client => `${client.ip}::${client.location}:${client.id}`).join('\n'));
    console.log(`Текущие IDs: `, ids.map(id => `${id.location}:${id.id}`));
  });

  ws.on("error", (err) => {
    console.error(err);
  });
};
