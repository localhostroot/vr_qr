<script>
	import { globals } from '$lib/+stores.svelte.js';
	import { goto } from '$app/navigation';
	import Header from '$lib/components/Header.svelte';
	import Loader from '$lib/components/Loader.svelte';

	// Access reactive state using Svelte 5 runes
	let clients = $derived(globals.get('clients').list);
	let isLoading = $derived(globals.get('clients').isLoading);

	function selectClient(location, id) {
		goto(`/vr/${location}/${id}`);
	}
</script>

<svelte:head>
	<title>VR Device Selection</title>
</svelte:head>

{#if isLoading}
	<Loader />
{:else if clients && clients.length > 0}
	<div class="wrapper">
		<Header />
		<div class="vr-list">
			{#each clients as client, index (client.id)}
				<div 
					class="vr-item" 
					onclick={() => selectClient(client.location, client.id)}
					role="button"
					tabindex="0"
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							selectClient(client.location, client.id);
						}
					}}
				>
					<img class="logo" src="/images/vr-goggles.svg" alt="VR Goggles" />
					<div class="number">{client.location}:{client.id}</div>
				</div>
			{/each}
		</div>
	</div>
{:else}
	<div class="wrapper">
		<Header />
		<div class="no-clients">
			<h2>No VR devices available</h2>
			<p>Please wait while we connect to VR devices...</p>
		</div>
	</div>
{/if}

<style>
	.wrapper {
		min-height: 100vh;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		display: flex;
		flex-direction: column;
	}

	.vr-list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 20px;
		padding: 40px 20px;
		max-width: 800px;
		margin: 0 auto;
		flex: 1;
		align-content: center;
	}

	.vr-item {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 16px;
		padding: 30px 20px;
		text-align: center;
		cursor: pointer;
		transition: all 0.3s ease;
		border: 2px solid transparent;
		backdrop-filter: blur(10px);
		position: relative;
		overflow: hidden;
	}

	.vr-item:hover {
		transform: translateY(-5px);
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.3);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
	}

	.vr-item:focus {
		outline: none;
		border-color: #4ade80;
		box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.3);
	}

	.logo {
		width: 60px;
		height: 60px;
		margin-bottom: 15px;
		filter: brightness(0) invert(1);
		opacity: 0.9;
	}

	.number {
		font-size: 18px;
		font-weight: 600;
		color: #fff;
		letter-spacing: 1px;
	}

	.no-clients {
		text-align: center;
		padding: 60px 20px;
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
	}

	.no-clients h2 {
		margin: 0 0 16px 0;
		font-size: 24px;
		color: rgba(255, 255, 255, 0.9);
	}

	.no-clients p {
		margin: 0;
		font-size: 16px;
		color: rgba(255, 255, 255, 0.7);
	}

	@media (max-width: 768px) {
		.vr-list {
			grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
			gap: 15px;
			padding: 20px 15px;
		}

		.vr-item {
			padding: 20px 15px;
		}

		.logo {
			width: 50px;
			height: 50px;
		}

		.number {
			font-size: 16px;
		}
	}
</style>
