<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { globals } from '$lib/stores/+stores.svelte.js';
	import { useWebSocket } from '$lib/utils/websocket.js';
	import { checkPaymentStatus } from '$lib/utils/paymentStatusChecker.js';
	import { PUBLIC_DATABASE, PUBLIC_BACKEND, PUBLIC_STAT } from '$env/static/public';
	import FixedNavigation from '$lib/components/widgets/FixedNavigation.svelte';
	import Footer from '$lib/components/widgets/Footer.svelte';

	let webSocketManager;

	// Determine if FixedNavigation should be shown based on current route
	let showFixedNavigation = $derived($page.route.id !== '/' && $page.route.id !== '/site-admin');

	onMount(() => {
		// Initialize WebSocket connection
		webSocketManager = useWebSocket(PUBLIC_BACKEND, 'getVr');
		webSocketManager.connect();

		// Check payment status on app startup
		checkPaymentStatus();

		// Cleanup on destroy
		return () => {
			if (webSocketManager) {
				webSocketManager.disconnect();
			}
		};
	});
</script>

<div class="App">
	<div class="content-wrapper">
		<slot />
	</div>
	{#if showFixedNavigation}
		<FixedNavigation />
	{/if}
	<Footer />
</div>
