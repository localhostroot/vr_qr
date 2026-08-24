<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { globals } from '$lib/stores/+stores.svelte.js';
	import { useWebSocket } from '$lib/utils/websocket.js';
	import { startPaymentStatusMonitor } from '$lib/utils/paymentStatusChecker.js';
	import { PUBLIC_DATABASE, PUBLIC_BACKEND, PUBLIC_STAT } from '$env/static/public';
	import FixedNavigation from '$lib/components/widgets/FixedNavigation.svelte';
	import Footer from '$lib/components/widgets/Footer.svelte';

	let webSocketManager;
	let stopPaymentStatusMonitor;

	// Determine if FixedNavigation should be shown based on current route
	let showFixedNavigation = $derived($page.route.id !== '/' && $page.route.id !== '/site-admin' && $page.route.id !== '/stats');
	let currentClient = $derived(globals.get('currentClient'));
	let clientLocation = $derived($page.params.location || currentClient?.location || null);
	let clientId = $derived($page.params.id || currentClient?.id || null);
	let browserTitle = $derived(
		$page.route.id === '/stats'
			? 'Статистика'
			: $page.route.id === '/'
				? 'Мониторинг'
				: showFixedNavigation && clientLocation && clientId
					? `${clientLocation}:${clientId}`
					: '4nebaVR'
	);

	onMount(() => {
		// Initialize WebSocket connection
		webSocketManager = useWebSocket(PUBLIC_BACKEND, 'getVrOverview');
		webSocketManager.connect();

		// Keep pending payment/token state in sync without requiring a page refresh.
		stopPaymentStatusMonitor = startPaymentStatusMonitor();

		// Cleanup on destroy
		return () => {
			if (webSocketManager) {
				webSocketManager.disconnect();
			}
			if (stopPaymentStatusMonitor) {
				stopPaymentStatusMonitor();
			}
		};
	});
</script>

<svelte:head>
	<title>{browserTitle}</title>
</svelte:head>

<div class="App">
	<div class="content-wrapper">
		<slot />
	</div>
	{#if showFixedNavigation}
		<FixedNavigation />
		<Footer />
	{/if}
</div>
