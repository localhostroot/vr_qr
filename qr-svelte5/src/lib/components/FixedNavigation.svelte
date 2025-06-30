<script>
	import { page } from '$app/stores';
	import { globals } from '$lib/+stores.svelte.js';
	import { icons } from '$lib/icons/index.js';
	
	let currentPath = $derived($page.url.pathname);
	let queueCount = $derived(globals.get('queue').items.length);
</script>

<nav class="fixed-nav">
	<a href="/" class:active={currentPath === '/'}>
		{@html icons.home}
		<span>Home</span>
	</a>
	
	<a href="/queue" class:active={currentPath === '/queue'}>
		<div class="queue-icon">
			{@html icons.queue}
			{#if queueCount > 0}
				<span class="badge">{queueCount}</span>
			{/if}
		</div>
		<span>Queue</span>
	</a>
	
	<a href="/films" class:active={currentPath === '/films'}>
		{@html icons.films}
		<span>Films</span>
	</a>
	
	<a href="/enter-token" class:active={currentPath === '/enter-token'}>
		{@html icons.token}
		<span>Token</span>
	</a>
</nav>

<style>
	.fixed-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: rgba(0, 0, 0, 0.95);
		backdrop-filter: blur(20px);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		display: flex;
		justify-content: space-around;
		padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
		z-index: 1000;
	}

	.fixed-nav a {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 8px 12px;
		color: rgba(255, 255, 255, 0.6);
		text-decoration: none;
		transition: all 0.2s ease;
		border-radius: 8px;
		min-width: 60px;
	}

	.fixed-nav a:hover {
		color: rgba(255, 255, 255, 0.9);
		background: rgba(255, 255, 255, 0.05);
	}

	.fixed-nav a.active {
		color: #4ade80;
		background: rgba(74, 222, 128, 0.1);
	}

	.fixed-nav a span {
		font-size: 12px;
		font-weight: 500;
	}

	.queue-icon {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.badge {
		position: absolute;
		top: -8px;
		right: -8px;
		background: #ef4444;
		color: white;
		font-size: 10px;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 10px;
		min-width: 16px;
		text-align: center;
		line-height: 1.2;
	}

	@media (max-width: 480px) {
		.fixed-nav a {
			padding: 6px 8px;
			min-width: 50px;
		}

		.fixed-nav a span {
			font-size: 11px;
		}
	}
</style>
