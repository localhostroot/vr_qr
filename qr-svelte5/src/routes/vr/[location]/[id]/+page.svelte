<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { globals } from '$lib/+stores.svelte.js';
	import { apiService } from '$lib/services/api.js';
	import Header from '$lib/components/Header.svelte';
	import Loader from '$lib/components/Loader.svelte';
	import ContentCard from '$lib/components/ContentCard.svelte';
	import VrPlayer from '$lib/components/VrPlayer.svelte';

	// Get route parameters
	let location = $derived($page.params.location);
	let id = $derived($page.params.id);

	// Local state
	let library = $state([]);
	let isLoading = $state(true);
	let error = $state(null);

	// Load content library
	onMount(async () => {
		try {
			isLoading = true;
			const data = await apiService.fetchLibrary();
			library = data || [];
		} catch (err) {
			console.error('Failed to load library:', err);
			error = 'Failed to load content library';
		} finally {
			isLoading = false;
		}
	});

	function scrollToNovelty() {
		const element = document.getElementById('content-section');
		if (element) {
			element.scrollIntoView({ behavior: 'smooth' });
		}
	}
</script>

<svelte:head>
	<title>VR Control - {location}:{id}</title>
</svelte:head>

{#if isLoading}
	<Loader />
{:else if error}
	<div class="error-container">
		<Header />
		<div class="error">
			<h2>Error Loading Content</h2>
			<p>{error}</p>
			<button onclick={() => window.location.reload()}>
				Try Again
			</button>
		</div>
	</div>
{:else}
	<div class="main-page">
		<Header />
		
		<section class="hero-section">
			<div class="hero-content">
				<h1>VR Device Control</h1>
				<p>Connected to: <strong>{location}:{id}</strong></p>
				<button class="scroll-btn" onclick={scrollToNovelty}>
					Browse Content
				</button>
			</div>
		</section>

		<section id="content-section" class="content-section">
			<div class="container">
				<h2>Available Content</h2>
				
				{#if library && library.length > 0}
					<div class="content-grid">
						{#each library as item (item.id)}
							<ContentCard {item} {location} {id} />
						{/each}
					</div>
				{:else}
					<div class="no-content">
						<p>No content available at the moment.</p>
					</div>
				{/if}
			</div>
		</section>

		<VrPlayer {location} {id} />
	</div>
{/if}

<style>
	.main-page {
		min-height: 100vh;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	}

	.hero-section {
		padding: 80px 20px;
		text-align: center;
		color: white;
	}

	.hero-content h1 {
		font-size: 3rem;
		margin: 0 0 1rem 0;
		font-weight: 700;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.hero-content p {
		font-size: 1.25rem;
		margin: 0 0 2rem 0;
		opacity: 0.9;
	}

	.scroll-btn {
		background: rgba(255, 255, 255, 0.2);
		border: 2px solid rgba(255, 255, 255, 0.3);
		color: white;
		padding: 12px 24px;
		border-radius: 50px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s ease;
		backdrop-filter: blur(10px);
	}

	.scroll-btn:hover {
		background: rgba(255, 255, 255, 0.3);
		border-color: rgba(255, 255, 255, 0.5);
		transform: translateY(-2px);
	}

	.content-section {
		background: #000;
		padding: 60px 20px;
		min-height: 50vh;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
	}

	.content-section h2 {
		color: white;
		font-size: 2.5rem;
		margin: 0 0 3rem 0;
		text-align: center;
		font-weight: 600;
	}

	.content-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 30px;
		margin-bottom: 40px;
	}

	.no-content {
		text-align: center;
		padding: 60px 20px;
		color: rgba(255, 255, 255, 0.7);
	}

	.error-container {
		min-height: 100vh;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		display: flex;
		flex-direction: column;
	}

	.error {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		text-align: center;
		color: white;
		padding: 40px 20px;
	}

	.error h2 {
		font-size: 2rem;
		margin: 0 0 1rem 0;
	}

	.error p {
		font-size: 1.1rem;
		margin: 0 0 2rem 0;
		opacity: 0.8;
	}

	.error button {
		background: #4ade80;
		border: none;
		color: white;
		padding: 12px 24px;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.error button:hover {
		background: #22c55e;
	}

	@media (max-width: 768px) {
		.hero-content h1 {
			font-size: 2rem;
		}

		.hero-content p {
			font-size: 1rem;
		}

		.content-section h2 {
			font-size: 2rem;
		}

		.content-grid {
			grid-template-columns: 1fr;
			gap: 20px;
		}

		.hero-section {
			padding: 60px 20px;
		}
	}
</style>
