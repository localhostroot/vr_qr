import { APIHandler, VRHandler } from '../handlers/index.js'
import fs from 'fs/promises';
import path from 'path';

const clients = []
const ids = []

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
        const client = clients[clientIndex];
        
        // Calculate and save uptime
        if (client.connectionTimestamp) {
          const disconnectionTime = Date.now();
          const uptimeMs = disconnectionTime - client.connectionTimestamp;
          const uptimeFormatted = formatUptime(uptimeMs);
          
          // Save uptime to JSON file
          saveUptime(closingLocation, closingUserId, uptimeFormatted);
        }

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
