import { browser } from '$app/environment';
import { globals, storeHelpers } from '$lib/+stores.svelte.js';

/**
 * WebSocket service for real-time communication with VR clients
 */
export class WebSocketService {
	constructor() {
		this.socket = null;
		this.reconnectInterval = null;
		this.reconnectAttempts = 0;
		this.maxReconnectAttempts = 5;
		this.reconnectDelay = 3000;
		this.isConnecting = false;
	}

	/**
	 * Connect to WebSocket server
	 * @param {string} url - WebSocket URL
	 * @param {string} messageType - Type of message to send (e.g., 'getVr')
	 */
	connect(url, messageType = 'getVr') {
		if (!browser || this.isConnecting) return;

		this.isConnecting = true;
		storeHelpers.setClientsLoading(true);

		try {
			this.socket = new WebSocket(url);
			this.messageType = messageType;

			this.socket.onopen = () => {
				console.log('WebSocket connected');
				this.isConnecting = false;
				this.reconnectAttempts = 0;
				
				// Send initial request
				this.sendMessage(messageType);

				// Set up periodic requests every 5 seconds
				if (this.reconnectInterval) {
					clearInterval(this.reconnectInterval);
				}
				this.reconnectInterval = setInterval(() => {
					this.sendMessage(messageType);
				}, 5000);
			};

			this.socket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					
					if (Array.isArray(data)) {
						storeHelpers.setClients(data);
					} else if (data.type === 'requestResponse') {
						console.log('Server response:', data.message);
					} else {
						console.log('WebSocket message:', data);
					}
				} catch (error) {
					console.error('Error parsing WebSocket message:', error);
				}
			};

			this.socket.onerror = (error) => {
				console.error('WebSocket error:', error);
				storeHelpers.setClientsError('WebSocket connection error');
				this.isConnecting = false;
			};

			this.socket.onclose = (event) => {
				console.log('WebSocket closed:', event.code, event.reason);
				this.isConnecting = false;
				
				if (this.reconnectInterval) {
					clearInterval(this.reconnectInterval);
				}

				// Attempt to reconnect if not manually closed
				if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
					setTimeout(() => {
						this.reconnectAttempts++;
						console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
						this.connect(url, messageType);
					}, this.reconnectDelay);
				}
			};

		} catch (error) {
			console.error('Failed to create WebSocket connection:', error);
			storeHelpers.setClientsError('Failed to connect to server');
			this.isConnecting = false;
		}
	}

	/**
	 * Send message to WebSocket server
	 * @param {string} type - Message type
	 * @param {Object} data - Additional data to send
	 */
	sendMessage(type, data = {}) {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			const message = JSON.stringify({
				type,
				...data
			});
			this.socket.send(message);
		}
	}

	/**
	 * Send video to specific client
	 * @param {string} clientId - Client ID
	 * @param {string} location - Client location
	 * @param {string} videoId - Video ID to send
	 */
	sendVideoToClient(clientId, location, videoId) {
		this.sendMessage('videoForClient', {
			clientId,
			location,
			videoId
		});
	}

	/**
	 * Add video to client queue
	 * @param {string} clientId - Client ID
	 * @param {string} location - Client location
	 * @param {string} videoId - Video ID to add to queue
	 */
	addToClientQueue(clientId, location, videoId) {
		this.sendMessage('addToQueue', {
			clientId,
			location,
			videoId
		});
	}

	/**
	 * Remove video from client queue
	 * @param {string} clientId - Client ID
	 * @param {string} location - Client location
	 * @param {string} videoId - Video ID to remove from queue
	 */
	removeFromClientQueue(clientId, location, videoId) {
		this.sendMessage('removeFromQueue', {
			clientId,
			location,
			videoId
		});
	}

	/**
	 * Clear client queue
	 * @param {string} clientId - Client ID
	 * @param {string} location - Client location
	 */
	clearClientQueue(clientId, location) {
		this.sendMessage('clean', {
			clientId,
			location
		});
	}

	/**
	 * Stop current video on client
	 * @param {string} clientId - Client ID
	 * @param {string} location - Client location
	 */
	stopVideo(clientId, location) {
		this.sendMessage('stop', {
			clientId,
			location
		});
	}

	/**
	 * Send notification to client
	 * @param {string} clientId - Client ID
	 * @param {string} location - Client location
	 * @param {string} message - Notification message
	 */
	sendNotification(clientId, location, message) {
		this.sendMessage('notification', {
			clientId,
			location,
			noti: message
		});
	}

	/**
	 * Reset client
	 * @param {string} clientId - Client ID
	 * @param {string} location - Client location
	 */
	resetClient(clientId, location) {
		this.sendMessage('reset', {
			clientId,
			location
		});
	}

	/**
	 * Disconnect WebSocket
	 */
	disconnect() {
		if (this.reconnectInterval) {
			clearInterval(this.reconnectInterval);
			this.reconnectInterval = null;
		}

		if (this.socket) {
			this.socket.close(1000, 'Manual disconnect');
			this.socket = null;
		}

		this.reconnectAttempts = 0;
		this.isConnecting = false;
	}

	/**
	 * Get current connection state
	 * @returns {boolean} - True if connected
	 */
	isConnected() {
		return this.socket && this.socket.readyState === WebSocket.OPEN;
	}
}

// Export singleton instance
export const webSocketService = new WebSocketService();
