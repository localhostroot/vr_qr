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

	// Determine if FixedNavigation should be shown based on current route
	let showFixedNavigation = $derived($page.route.id !== '/' && $page.route.id !== '/site-admin' && $page.route.id !== '/stats');
	let currentClient = $derived(globals.get('currentClient'));
	let isViewerRoute = $derived($page.route.id?.startsWith('/[location]/[id]'));
	let clientLocation = $derived(isViewerRoute ? $page.params.location : currentClient?.location || null);
	let clientId = $derived(isViewerRoute ? $page.params.id : currentClient?.id || null);
	let viewerUserId = $derived(
		isViewerRoute && $page.params.location && $page.params.id
			? `${$page.params.location}/${$page.params.id}`
			: null
	);
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

		// Cleanup on destroy
		return () => {
			if (webSocketManager) {
				webSocketManager.disconnect();
			}
		};
	});

	// The payment monitor belongs only to a concrete viewer.  The root
	// monitoring, statistics and site-admin pages must never claim a viewer's
	// order merely because that browser profile still has viewer localStorage.
	$effect(() => {
		if (!viewerUserId) return;

		return startPaymentStatusMonitor({ userId: viewerUserId });
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
