<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { globals, setupLocalStorageSync } from '$lib/+stores.svelte.js';
	import { webSocketService } from '$lib/services/websocket.js';
	import { PUBLIC_VITE_REACT_APP_BACKEND } from '$env/static/public';
	import Header from '$lib/components/Header.svelte';
	import FixedNavigation from '$lib/components/FixedNavigation.svelte';
	import Footer from '$lib/components/Footer.svelte';
	// import '../app.css';

	import { apiService } from '$lib/services/api.js';

	// Setup localStorage synchronization - watch for changes and sync to localStorage
	const sync = setupLocalStorageSync();
	
	$effect(() => {
		// Watch clients and sync to localStorage
		globals.get('clients');
		sync.syncClients();
	});

	$effect(() => {
		// Watch queue and sync to localStorage
		globals.get('queue');
		sync.syncQueue();
	});

	$effect(() => {
		// Watch paidFilms and sync to localStorage
		globals.get('paidFilms');
		sync.syncPaidFilms();
	});

	$effect(() => {
		// Watch slider and sync to localStorage
		globals.get('slider');
		sync.syncSlider();
	});

	$effect(() => {
		// Watch token and sync to localStorage
		globals.get('token');
		sync.syncToken();
	});

	$effect(() => {
		// Watch payment and sync to localStorage
		globals.get('payment');
		sync.syncPayment();
		sync.syncQueuePendingPayment();
	});

	onMount(async () => {
		if (browser) {
			// Initialize WebSocket connection
			const wsUrl = PUBLIC_VITE_REACT_APP_BACKEND || 'wss://4-neba.ru/control/api/';
			webSocketService.connect(wsUrl, 'getVr');
		}
	});

	onDestroy(async () => {
		if (browser) {
			webSocketService.disconnect();
		}
	});

	$effect(() => {
		window.apiService = apiService;
	})
</script>

<div class="app">
	<div class="content-wrapper">
		<slot />
	</div>
	<FixedNavigation />
	<Footer />
</div>

<style>
	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		position: relative;
	}

	.content-wrapper {
		flex: 1;
		padding-bottom: 80px; /* Space for fixed navigation */
	}

	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background-color: #000;
		color: #fff;
	}

	:global(*, *::before, *::after) {
		box-sizing: border-box;
	}
</style>
