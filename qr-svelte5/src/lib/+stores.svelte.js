// @ts-nocheck
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

// Global storage state
let globalStorage = $state({
	// Clients data
	clients: {
		list: loadFromLocalStorage(LOCAL_STORAGE_KEYS.CLIENTS) || [],
		isLoading: true,
		error: null
	},

	// Queue data
	queue: {
		items: loadFromLocalStorage(LOCAL_STORAGE_KEYS.QUEUE) || []
	},

	// Paid films data
	paidFilms: {
		items: loadFromLocalStorage(LOCAL_STORAGE_KEYS.PAID_FILMS) || []
	},

	// Slider state
	slider: {
		currentIndex: loadFromLocalStorage(LOCAL_STORAGE_KEYS.SLIDER_INDEX) || 0
	},

	// Token data
	token: {
		value: loadFromLocalStorage(LOCAL_STORAGE_KEYS.TOKEN)?.token || null,
		expiry: loadFromLocalStorage(LOCAL_STORAGE_KEYS.TOKEN)?.expiry || null
	},

	// Payment data
	payment: {
		orderId: loadFromLocalStorage(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID) || null,
		queuePendingPayment: loadFromLocalStorage(LOCAL_STORAGE_KEYS.QUEUE_PENDING_PAYMENT) || null
	}
});

function getGlobals() {
	function update(item, handler) {
		globalStorage[item] = handler(globalStorage[item]);
	}

	return {
		get(item) {
			return globalStorage[item];
		},

		set(item, value) {
			globalStorage[item] = value;
		},

		update
	};
}

export const globals = getGlobals();

// Export utilities for localStorage sync (to be used in components)
export function setupLocalStorageSync() {
	// This function should be called from a component to set up localStorage sync
	return {
		syncClients: () => saveToLocalStorage(LOCAL_STORAGE_KEYS.CLIENTS, globalStorage.clients.list),
		syncQueue: () => saveToLocalStorage(LOCAL_STORAGE_KEYS.QUEUE, globalStorage.queue.items),
		syncPaidFilms: () => saveToLocalStorage(LOCAL_STORAGE_KEYS.PAID_FILMS, globalStorage.paidFilms.items),
		syncSlider: () => saveToLocalStorage(LOCAL_STORAGE_KEYS.SLIDER_INDEX, globalStorage.slider.currentIndex),
		syncToken: () => saveToLocalStorage(LOCAL_STORAGE_KEYS.TOKEN, {
			token: globalStorage.token.value,
			expiry: globalStorage.token.expiry
		}),
		syncPayment: () => saveToLocalStorage(LOCAL_STORAGE_KEYS.PAYKEEPER_ORDER_ID, globalStorage.payment.orderId),
		syncQueuePendingPayment: () => saveToLocalStorage(LOCAL_STORAGE_KEYS.QUEUE_PENDING_PAYMENT, globalStorage.payment.queuePendingPayment)
	};
}

// Helper functions for common operations (optional - you can use globals.update directly)
export const storeHelpers = {
	// Client helpers
	setClients(clientsList) {
		globals.update('clients', current => ({
			...current,
			list: clientsList,
			isLoading: false,
			error: null
		}));
	},

	setClientsLoading(loading) {
		globals.update('clients', current => ({
			...current,
			isLoading: loading
		}));
	},

	setClientsError(error) {
		globals.update('clients', current => ({
			...current,
			error: error,
			isLoading: false
		}));
	},

	// Queue helpers
	addToQueue(item) {
		globals.update('queue', current => ({
			...current,
			items: [...current.items, item]
		}));
	},

	removeFromQueue(itemId) {
		globals.update('queue', current => ({
			...current,
			items: current.items.filter(item => item.id !== itemId)
		}));
	},

	clearQueue() {
		globals.update('queue', current => ({
			...current,
			items: []
		}));
	},

	// Paid films helpers
	addPaidFilm(film) {
		globals.update('paidFilms', current => {
			const exists = current.items.some(f => f.id === film.id);
			if (!exists) {
				return {
					...current,
					items: [...current.items, film]
				};
			}
			return current;
		});
	},

	setPaidFilms(films) {
		globals.update('paidFilms', current => ({
			...current,
			items: films || []
		}));
	},

	clearPaidFilms() {
		globals.update('paidFilms', current => ({
			...current,
			items: []
		}));
	},

	// Token helpers
	setToken(tokenValue, expiry) {
		globals.update('token', current => ({
			...current,
			value: tokenValue,
			expiry: expiry
		}));
	},

	removeToken() {
		globals.update('token', current => ({
			...current,
			value: null,
			expiry: null
		}));
	},

	// Slider helpers
	setSliderIndex(index) {
		globals.update('slider', current => ({
			...current,
			currentIndex: index
		}));
	},

	// Payment helpers
	setPaykeeperOrderId(orderId) {
		globals.update('payment', current => ({
			...current,
			orderId: orderId
		}));
	},

	removePaykeeperOrderId() {
		globals.update('payment', current => ({
			...current,
			orderId: null
		}));
	},

	setQueuePendingPayment(queue) {
		globals.update('payment', current => ({
			...current,
			queuePendingPayment: queue
		}));
	},

	removeQueuePendingPayment() {
		globals.update('payment', current => ({
			...current,
			queuePendingPayment: null
		}));
	}
};
