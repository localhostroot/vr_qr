<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { globals } from '$lib/stores/+stores.svelte.js';
	import { useWebSocket } from '$lib/utils/websocket.js';
	import { startPaymentStatusMonitor } from '$lib/utils/paymentStatusChecker.js';
	import { setCookie } from '$lib/utils/+helpers.svelte.js';
	import { PUBLIC_DATABASE, PUBLIC_BACKEND, PUBLIC_STAT } from '$env/static/public';
	import FixedNavigation from '$lib/components/widgets/FixedNavigation.svelte';
	import Footer from '$lib/components/widgets/Footer.svelte';

	let webSocketManager;
	let monitorAuthState = $state('checking');
	let monitorPassword = $state('');
	let monitorAuthMessage = $state('');
	let monitorAuthLoading = $state(false);

	// Determine if FixedNavigation should be shown based on current route
	let showFixedNavigation = $derived($page.route.id !== '/' && $page.route.id !== '/site-admin' && $page.route.id !== '/stats');
	let currentClient = $derived(globals.get('currentClient'));
	let isViewerRoute = $derived($page.route.id?.startsWith('/[location]/[id]'));
	let isMonitorRoute = $derived($page.route.id === '/');
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

	// The viewer encoded in the URL is authoritative. A browser can retain the
	// previous headset in localStorage/cookies, so synchronize it before child
	// pages use currentClient for labels or control requests.
	$effect.pre(() => {
		if (!browser || !viewerUserId || !clientLocation || !clientId) return;
		if (currentClient?.location === clientLocation && currentClient?.id === clientId) return;

		const routeClient = { location: clientLocation, id: clientId };
		globals.set('currentClient', routeClient);
		setCookie('CURRENT_CLIENT', JSON.stringify(routeClient), 7);
	});

	function connectWebSocket(type) {
		if (webSocketManager) return;
		webSocketManager = useWebSocket(PUBLIC_BACKEND, type);
		webSocketManager.connect();
	}

	async function checkMonitorSession() {
		try {
			const response = await fetch(`${PUBLIC_DATABASE}api/admin/session/`, {
				cache: 'no-store',
				credentials: 'include'
			});
			const data = await response.json();
			monitorAuthState = response.ok && data.authenticated ? 'signedIn' : 'signedOut';
		} catch (error) {
			monitorAuthState = 'signedOut';
			monitorAuthMessage = `Ошибка подключения: ${error.message}`;
		}

		if (monitorAuthState === 'signedIn') {
			connectWebSocket('getVrOverview');
		} else if (webSocketManager) {
			webSocketManager.disconnect();
			webSocketManager = null;
		}
	}

	async function loginToMonitor() {
		if (!monitorPassword || monitorAuthLoading) return;
		monitorAuthLoading = true;
		monitorAuthMessage = '';
		try {
			const response = await fetch(`${PUBLIC_DATABASE}api/admin/login/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ password: monitorPassword })
			});
			const data = await response.json();
			if (!response.ok || !data.authenticated) {
				monitorAuthMessage = data.error || 'Не удалось войти.';
				return;
			}
			monitorPassword = '';
			monitorAuthState = 'signedIn';
			connectWebSocket('getVrOverview');
		} catch (error) {
			monitorAuthMessage = `Ошибка подключения: ${error.message}`;
		} finally {
			monitorAuthLoading = false;
		}
	}

	async function logoutFromMonitor() {
		try {
			await fetch(`${PUBLIC_DATABASE}api/admin/logout/`, {
				method: 'POST',
				credentials: 'include'
			});
		} finally {
			if (webSocketManager) webSocketManager.disconnect();
			webSocketManager = null;
			monitorAuthState = 'signedOut';
		}
	}

	onMount(() => {
		let monitorSessionIntervalId;
		if (isMonitorRoute) {
			checkMonitorSession();
			monitorSessionIntervalId = window.setInterval(checkMonitorSession, 60_000);
		} else if (isViewerRoute) {
			// Viewer pages only need the legacy list of available headsets. The
			// detailed monitoring feed is opened only after administrator login.
			connectWebSocket('getVr');
		}

		// Cleanup on destroy
		return () => {
			if (monitorSessionIntervalId) window.clearInterval(monitorSessionIntervalId);
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

	$effect(() => {
		const userId = viewerUserId;
		if (!browser || !userId) {
			globals.set('freeAccess', false);
			return;
		}

		const controller = new AbortController();
		globals.set('freeAccess', false);
		fetch(
			`${PUBLIC_DATABASE}api/payments/free_access_status/?user_id=${encodeURIComponent(userId)}`,
			{ signal: controller.signal },
		)
			.then((response) => response.ok ? response.json() : null)
			.then((data) => {
				if (!controller.signal.aborted) {
					globals.set('freeAccess', data?.free_access === true);
				}
			})
			.catch((error) => {
				if (error?.name !== 'AbortError') {
					globals.set('freeAccess', false);
				}
			});

		return () => controller.abort();
	});
</script>

<svelte:head>
	<title>{browserTitle}</title>
</svelte:head>

{#if isMonitorRoute && monitorAuthState !== 'signedIn'}
	<div class="monitor-login-shell">
		<div class="monitor-login-card">
			<h1>Мониторинг</h1>
			{#if monitorAuthState === 'checking'}
				<p>Проверка доступа...</p>
			{:else}
				<p>Введите пароль административного раздела.</p>
				<form onsubmit={(event) => { event.preventDefault(); loginToMonitor(); }}>
					<input
						type="password"
						bind:value={monitorPassword}
						autocomplete="current-password"
						placeholder="Пароль"
					/>
					<button type="submit" disabled={monitorAuthLoading || !monitorPassword}>
						{monitorAuthLoading ? 'Вход...' : 'Войти'}
					</button>
				</form>
				{#if monitorAuthMessage}<div class="monitor-auth-error">{monitorAuthMessage}</div>{/if}
			{/if}
		</div>
	</div>
{:else}
	<div class="App">
		{#if isMonitorRoute}
			<button class="monitor-logout" onclick={logoutFromMonitor}>Выйти</button>
		{/if}
		<div class="content-wrapper">
			<slot />
		</div>
		{#if showFixedNavigation}
			<FixedNavigation />
			<Footer />
		{/if}
	</div>
{/if}

<style>
	.monitor-login-shell {
		min-height: 100vh;
		display: grid;
		place-items: start center;
		padding-top: 12vh;
		box-sizing: border-box;
		background: var(--color-dark-primary, #0d1117);
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
	}

	.monitor-login-card {
		width: min(480px, calc(100% - 32px));
		padding: 28px;
		box-sizing: border-box;
		background: white;
		border-radius: 12px;
		box-shadow: 0 4px 18px rgba(0, 0, 0, 0.22);
	}

	.monitor-login-card h1 { margin: 0; }
	.monitor-login-card p { color: #555; }
	.monitor-login-card form { display: flex; gap: 10px; }
	.monitor-login-card input {
		flex: 1;
		min-width: 0;
		padding: 12px;
		border: 2px solid #ddd;
		border-radius: 8px;
		font-size: 16px;
	}
	.monitor-login-card button,
	.monitor-logout {
		padding: 12px 20px;
		border: 0;
		border-radius: 8px;
		background: #111827;
		color: white;
		cursor: pointer;
	}
	.monitor-login-card button:disabled { opacity: 0.55; cursor: default; }
	.monitor-auth-error {
		margin-top: 14px;
		padding: 10px;
		border-radius: 6px;
		background: #ffe6e6;
		color: #a61b1b;
	}
	.monitor-logout {
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 20;
		background: rgba(255, 255, 255, 0.14);
	}
</style>
