import axios from 'axios';
import { 
	PUBLIC_VITE_REACT_APP_DATABASE, 
	PUBLIC_VITE_REACT_APP_STAT 
} from '$env/static/public';

/**
 * API service for HTTP requests
 */
class ApiService {
	constructor() {
		// Create axios instances
		this.databaseApi = axios.create({
			baseURL: PUBLIC_VITE_REACT_APP_DATABASE || 'https://4-neba.ru/',
			timeout: 10000,
			headers: {
				'Content-Type': 'application/json'
			}
		});

		this.statApi = axios.create({
			baseURL: PUBLIC_VITE_REACT_APP_STAT || 'https://admin.4-neba.ru/api/api/',
			timeout: 10000,
			headers: {
				'Content-Type': 'application/json'
			}
		});

		// Request interceptors
		this.databaseApi.interceptors.request.use(
			(config) => {
				console.log(`Making request to: ${config.baseURL}${config.url}`);
				return config;
			},
			(error) => Promise.reject(error)
		);

		// Response interceptors
		this.databaseApi.interceptors.response.use(
			(response) => response,
			(error) => {
				console.error('API Error:', error.response?.data || error.message);
				return Promise.reject(error);
			}
		);

		this.statApi.interceptors.response.use(
			(response) => response,
			(error) => {
				console.error('Stat API Error:', error.response?.data || error.message);
				return Promise.reject(error);
			}
		);
	}

	/**
	 * Fetch content library/films
	 */
	async fetchLibrary() {
		try {
			const response = await this.databaseApi.get('api/films/');
			return response.data;
		} catch (error) {
			console.error('Error fetching library:', error);
			throw error;
		}
	}

	/**
	 * Fetch specific content by ID
	 * @param {string|number} id - Content ID
	 */
	async fetchContentById(id) {
		try {
			const response = await this.databaseApi.get(`api/films/${id}/`);
			return response.data;
		} catch (error) {
			console.error(`Error fetching content ${id}:`, error);
			throw error;
		}
	}

	/**
	 * Fetch series/films list
	 */
	async fetchFilmsList() {
		try {
			const response = await this.databaseApi.get('api/series/');
			return response.data;
		} catch (error) {
			console.error('Error fetching films list:', error);
			throw error;
		}
	}

	/**
	 * Fetch series by ID
	 * @param {string|number} id - Series ID
	 */
	async fetchSeriesById(id) {
		try {
			const response = await this.databaseApi.get(`api/series/${id}/`);
			return response.data;
		} catch (error) {
			console.error(`Error fetching series ${id}:`, error);
			throw error;
		}
	}

	/**
	 * Validate token
	 * @param {string} token - Token to validate
	 */
	async validateToken(token) {
		try {
			const response = await this.databaseApi.post('api/tokens/validate/', {
				token
			});
			return response.data;
		} catch (error) {
			console.error('Error validating token:', error);
			throw error;
		}
	}

	/**
	 * Get films for token
	 * @param {string} token - Token
	 */
	async getFilmsForToken(token) {
		try {
			const response = await this.databaseApi.get(`api/tokens/get_films/?token=${token}`);
			return response.data;
		} catch (error) {
			console.error('Error getting films for token:', error);
			throw error;
		}
	}

	/**
	 * Check payment status
	 * @param {string} orderId - Order ID
	 */
	async checkPaymentStatus(orderId) {
		try {
			const response = await this.databaseApi.get(`api/status/status/?order_id=${orderId}`);
			return response.data;
		} catch (error) {
			console.error('Error checking payment status:', error);
			throw error;
		}
	}

	/**
	 * Get token by order ID
	 * @param {string} orderId - Order ID
	 * @param {string} currentToken - Current token (optional)
	 */
	async getTokenByOrder(orderId, currentToken = '') {
		try {
			let url = `api/tokens/get_token_by_order/?order_id=${orderId}`;
			if (currentToken) {
				url += `&current_token=${currentToken}`;
			}
			
			const response = await this.databaseApi.get(url);
			return response.data;
		} catch (error) {
			console.error('Error getting token by order:', error);
			throw error;
		}
	}

	/**
	 * Mark payment as checked
	 * @param {string} orderId - Order ID
	 */
	async markPaymentChecked(orderId) {
		try {
			const response = await this.databaseApi.post(`api/status/checked/?order_id=${orderId}`);
			return response.data;
		} catch (error) {
			console.error('Error marking payment as checked:', error);
			throw error;
		}
	}

	/**
	 * Create PayKeeper payment
	 * @param {Object} paymentData - Payment data
	 */
	async createPayment(paymentData) {
		try {
			const response = await this.databaseApi.post('api/paykeeper/create/', paymentData);
			return response.data;
		} catch (error) {
			console.error('Error creating payment:', error);
			throw error;
		}
	}

	/**
	 * Send purchase request
	 * @param {Array} queue - Queue items
	 * @param {string} clientId - Client ID
	 * @param {string} location - Location
	 */
	async sendPurchaseRequest(queue, clientId, location) {
		try {
			const response = await this.databaseApi.post('api/purchase/', {
				queue,
				clientId,
				location
			});
			return response.data;
		} catch (error) {
			console.error('Error sending purchase request:', error);
			throw error;
		}
	}

	/**
	 * Update statistics
	 * @param {Object} statsData - Statistics data
	 */
	async updateStatistics(statsData) {
		try {
			const response = await this.statApi.post('update_statistics/', statsData);
			return response.data;
		} catch (error) {
			console.error('Error updating statistics:', error);
			throw error;
		}
	}

	/**
	 * Generic GET request
	 * @param {string} endpoint - API endpoint
	 * @param {Object} params - Query parameters
	 * @param {boolean} useStat - Use stat API instead of database API
	 */
	async get(endpoint, params = {}, useStat = false) {
		try {
			const api = useStat ? this.statApi : this.databaseApi;
			const response = await api.get(endpoint, { params });
			return response.data;
		} catch (error) {
			console.error(`Error in GET ${endpoint}:`, error);
			throw error;
		}
	}

	/**
	 * Generic POST request
	 * @param {string} endpoint - API endpoint
	 * @param {Object} data - Request data
	 * @param {boolean} useStat - Use stat API instead of database API
	 */
	async post(endpoint, data = {}, useStat = false) {
		try {
			const api = useStat ? this.statApi : this.databaseApi;
			const response = await api.post(endpoint, data);
			return response.data;
		} catch (error) {
			console.error(`Error in POST ${endpoint}:`, error);
			throw error;
		}
	}
}

// Export singleton instance
export const apiService = new ApiService();
