Overview: Adding to Queue of Paid Films

Based on my analysis of the FilmsPage, ContentCardPaid components, and the control_server, here's how adding to queue of paid films works:

Architecture Overview

The system consists of:
1. SvelteKit frontend components
2. Control Server (WebSocket-based backend)
3. Database/API for token validation

Flow for Adding Paid Films to Queue

#### 1. Frontend Components

FilmsPage (`/qr_svelte5/src/routes/films/+page.svelte`):
•  Displays the list of paid films from the Svelte store
•  Renders ContentCardPaid components for each film
•  Provides client information (location, ID) to child components

ContentCardPaid component (`/qr_svelte5/src/lib/components/ContentCardPaid.svelte`):
•  Validates user token and film access before allowing actions
•  Manages button states: isActive, isPending, isInQueue, isOtherActive
•  Handles addToQueue action through handleAddToQueue function

#### 2. Token Validation Process

Before any queue operation:

// Validates token with database API
const validateToken = async () => {
  const url = `${databaseApi}api/tokens/validate/?token=${token}&film_id=${item.film_id}`;
  const response = await fetch(url);
  // Sets isValidToken and isValidFilm flags
}

#### 3. AddToQueue Handler

In ContentCardPaid Component:

const handleAddToQueue = async () => {
  if (!isValidToken || !isValidFilm) {
    requestError = "Нет доступа к этому фильму...";
    return;
  }
  
  try {
    await sendRequest(clientId, location, 'addToQueue', item.film_id, token);
    requestError = null;
  } catch (error) {
    requestError = `Произошла ошибка: ${error.message}`;
  }
};

#### 4. WebSocket Communication

sendRequest function establishes WebSocket connection:

const sendRequest = (clientId, location, type, videoId, token) => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${backendApi}`);
    
    ws.onopen = () => {
      const message = JSON.stringify({
        type: type,           // 'addToQueue'
        clientId: clientId,   // Client identifier
        location: location,   // Location identifier
        videoId: videoId,     // Film ID
        token: token          // Payment token
      });
      ws.send(message);
    };
    
    ws.onmessage = (event) => {
      const response = JSON.parse(event.data);
      if (response.type === 'requestResponse') {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.message));
        }
      }
    };
  });
};

#### 5. Control Server Processing

onAddToQueue handler in control_server:

const onAddToQueue = (ws, req, payload, clients) => {
  const client = clients.find(client => 
    client.id === payload.clientId && client.location === payload.location
  );
  
  if (client) {
    // Add video to client's pending queue
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
      message: 'Клиент не найден'
    }));
  }
};

#### 6. Queue Management

Client Object Structure:

{
  id: userId,
  location: location,
  pendingQueue: [],    // Queue for videos waiting to be played
  queue: [],          // Active queue
  currentVideoId: null,
  userPresent: false,
  isBlocked: false
}

Queue States:
•  pendingQueue: Videos added but not yet started
•  queue: Videos currently being processed
•  Different behavior based on userPresent and activity status

Key Features

1. Token-based Access Control: Each film requires valid token validation
2. Real-time Communication: WebSocket for instant queue updates
3. Client-specific Queues: Each VR client has its own queue
4. State Management: the Svelte store and backend maintain queue state
5. Error Handling: Comprehensive error messages for various failure scenarios

Security Considerations

•  Token validation against database before any queue operation
•  Client identification through location + ID combination
•  Automatic token expiry handling
•  Film access validation per user token

This architecture ensures that only authenticated users with valid payment tokens can add films to their respective VR client queues, with real-time synchronization between the mobile interface and VR headsets.
