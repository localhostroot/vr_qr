import { browser } from '$app/environment';

/**
 * Local storage utility functions
 */
function loadFromLocalStorage(key, defaultValue = null) {
	if (!browser) return defaultValue;
	try {
		const item = localStorage.getItem(key);
		return item ? JSON.parse(item) : defaultValue;
	} catch (error) {
		console.error(`Error loading ${key} from localStorage:`, error);
		return defaultValue;
	}
}

function saveToLocalStorage(key, value) {
	if (!browser) return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch (error) {
		console.error(`Error saving ${key} to localStorage:`, error);
	}
}

/**
 * Local storage keys constants
 */
export const LOCAL_STORAGE_KEYS = {
	QUEUE: 'qr_queue',
	PAID_FILMS: 'qr_paid_films',
	SLIDER_INDEX: 'qr_slider_index',
	CLIENTS: 'qr_clients',
	TOKEN: 'qr_token',
	PAYKEEPER_ORDER_ID: 'qr_paykeeper_order_id',
	QUEUE_PENDING_PAYMENT: 'qr_queue_pending_payment'
};

/**
 * Global state stores using Svelte 5 runes
 */
class Store {
	constructor() {
		// Initialize state
		this.clients = $state({
			list: loadFromLocalStorage(LOCAL_STORAGE_KEYS.CLIENTS) || [],
			isLoading: true,
			error: null
		});

		this.queue = $state({
			items: loadFromLocalStorage(LOCAL_STORAGE_KEYS.QUEUE) || []
		});

		this.paidFilms = $state({
			items: loadFromLocalStorage(LOCAL_STORAGE_KEYS.PAID_FILMS) || []
		});

		this.slider = $state({
			currentIndex: loadFromLocalStorage(LOCAL_STORAGE_KEYS.SLIDER_INDEX) || 0
		});

		this.token = $state({
			value: loadFromLocalStorage(LOCAL_STORAGE_KEYS.TOKEN)?.token || null,
			expiry: loadFromLocalStorage(LOCAL_STORAGE_KEYS.TOKEN)?.expiry || null
		});

		this.payment = $state({
			orderId: loadFromLocalStorage(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID) || null,
			queuePendingPayment: loadFromLocalStorage(LOCAL_STORAGE_KEYS.QUEUE_PENDING_PAYMENT) || null
		});

		// Set up automatic localStorage sync
		if (browser) {
			$effect(() => {
				saveToLocalStorage(LOCAL_STORAGE_KEYS.CLIENTS, this.clients.list);
			});

			$effect(() => {
				saveToLocalStorage(LOCAL_STORAGE_KEYS.QUEUE, this.queue.items);
			});

			$effect(() => {
				saveToLocalStorage(LOCAL_STORAGE_KEYS.PAID_FILMS, this.paidFilms.items);
			});

			$effect(() => {
				saveToLocalStorage(LOCAL_STORAGE_KEYS.SLIDER_INDEX, this.slider.currentIndex);
			});

			$effect(() => {
				saveToLocalStorage(LOCAL_STORAGE_KEYS.TOKEN, {
					token: this.token.value,
					expiry: this.token.expiry
				});
			});

			$effect(() => {
				saveToLocalStorage(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID, this.payment.orderId);
			});

			$effect(() => {
				saveToLocalStorage(LOCAL_STORAGE_KEYS.QUEUE_PENDING_PAYMENT, this.payment.queuePendingPayment);
			});
		}
	}

	// Client actions
	setClients(clientsList) {
		this.clients.list = clientsList;
		this.clients.isLoading = false;
		this.clients.error = null;
	}

	setClientsLoading(loading) {
		this.clients.isLoading = loading;
	}

	setClientsError(error) {
		this.clients.error = error;
		this.clients.isLoading = false;
	}

	// Queue actions
	addToQueue(item) {
		this.queue.items = [...this.queue.items, item];
	}

	removeFromQueue(itemId) {
		this.queue.items = this.queue.items.filter(item => item.id !== itemId);
	}

	clearQueue() {
		this.queue.items = [];
	}

	// Paid films actions
	addPaidFilm(film) {
		const exists = this.paidFilms.items.some(f => f.id === film.id);
		if (!exists) {
			this.paidFilms.items = [...this.paidFilms.items, film];
		}
	}

	setPaidFilms(films) {
		this.paidFilms.items = films || [];
	}

	clearPaidFilms() {
		this.paidFilms.items = [];
	}

	// Token actions
	setToken(tokenValue, expiry) {
		this.token.value = tokenValue;
		this.token.expiry = expiry;
	}

	removeToken() {
		this.token.value = null;
		this.token.expiry = null;
	}

	// Slider actions
	setSliderIndex(index) {
		this.slider.currentIndex = index;
	}

	// Payment actions
	setPaykeeperOrderId(orderId) {
		this.payment.orderId = orderId;
	}

	removePaykeeperOrderId() {
		this.payment.orderId = null;
	}

	setQueuePendingPayment(queue) {
		this.payment.queuePendingPayment = queue;
	}

	removeQueuePendingPayment() {
		this.payment.queuePendingPayment = null;
	}
}

// Export singleton store instance
export const store = new Store();
