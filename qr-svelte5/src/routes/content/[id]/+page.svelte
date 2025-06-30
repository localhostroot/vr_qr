<script>
// @ts-nocheck

	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { PUBLIC_VITE_API_URL } from '$env/static/public';
	import { apiService } from '$lib/services/api.js';
	import { webSocketService } from '$lib/services/websocket.js';
	import { icons } from '$lib/icons/index.js';
	import Header from '$lib/components/Header.svelte';
	import Loader from '$lib/components/Loader.svelte';

	// Get content ID from route parameters
	let contentId = $derived($page.params.id);

	// Local state
	let content = $state(null);
	let isLoading = $state(true);
	let error = $state(null);
	let isConnected = $state(false);

	// Load content details
	onMount(async () => {
		try {
			isLoading = true;
			// Note: This assumes your API has a content details endpoint
			const data = await apiService.fetchContentById(contentId);
			content = data;
		} catch (err) {
			console.error('Failed to load content:', err);
			error = 'Failed to load content details';
		} finally {
			isLoading = false;
		}

		// Check WebSocket connection status
		isConnected = webSocketService.isConnected();
		const checkConnection = setInterval(() => {
			isConnected = webSocketService.isConnected();
		}, 1000);

		return () => {
			clearInterval(checkConnection);
		};
	});

	function getImageUrl(imagePath) {
		if (!imagePath) return '';
		
		if (imagePath.startsWith('http')) {
			return imagePath;
		}
		
		const baseUrl = PUBLIC_VITE_API_URL || 'http://localhost:3001';
		return `${baseUrl}/images/${imagePath}`;
	}

	function getVideoUrl(filePath) {
		if (!filePath) return '';
		
		if (filePath.startsWith('http')) {
			return filePath;
		}
		
		const baseUrl = PUBLIC_VITE_API_URL || 'http://localhost:3001';
		return `${baseUrl}/videos/${filePath}`;
	}

	function playOnVR() {
		if (!content || !isConnected) return;

		const message = {
			type: 'PLAY_CONTENT',
			payload: {
				videoUrl: getVideoUrl(content.path),
				title: content.title,
				id: content.id
			}
		};

		webSocketService.send(message);
	}

	function goBack() {
		history.back();
	}
</script>

<svelte:head>
	<title>VR Content - {content?.title || 'Loading...'}</title>
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
{:else if content}
	<div class="content-page">
		<Header />
		
		<div class="container">
			<button class="back-button" onclick={goBack}>
				{@html icons.back}
				Back
			</button>

			<div class="content-details">
				<div class="content-media">
					{#if content.thumbnail}
						<img 
							src={getImageUrl(content.thumbnail)} 
							alt={content.title}
							class="content-image"
						/>
					{:else}
						<div class="placeholder-image">
							<span>No Image Available</span>
						</div>
					{/if}
					
					<div class="media-overlay">
						<button 
							class="play-button" 
							onclick={playOnVR}
							disabled={!isConnected}
						>
							{@html icons.playLarge}
							<span>{isConnected ? 'Play on VR' : 'VR Disconnected'}</span>
						</button>
					</div>
				</div>

				<div class="content-info">
					<div class="content-header">
						<h1>{content.title}</h1>
						
						<div class="content-meta">
							{#if content.category}
								<span class="category">{content.category}</span>
							{/if}
							
							{#if content.duration}
								<span class="duration">
									{@html icons.duration}
									{content.duration}
								</span>
							{/if}
							
							{#if content.fileSize}
								<span class="file-size">
									{@html icons.file}
									{content.fileSize}
								</span>
							{/if}
						</div>
					</div>

					{#if content.description}
						<div class="description">
							<h3>Description</h3>
							<p>{content.description}</p>
						</div>
					{/if}

					{#if content.tags && content.tags.length > 0}
						<div class="tags">
							<h3>Tags</h3>
							<div class="tag-list">
								{#each content.tags as tag}
									<span class="tag">{tag}</span>
								{/each}
							</div>
						</div>
					{/if}

					<div class="actions">
						<button 
							class="btn-primary" 
							onclick={playOnVR}
							disabled={!isConnected}
						>
							{isConnected ? 'Play on VR Device' : 'VR Device Disconnected'}
						</button>
						
						{#if content.path}
							<a 
								href={getVideoUrl(content.path)} 
								target="_blank" 
								class="btn-secondary"
							>
								Download File
							</a>
						{/if}
					</div>

					<div class="connection-status">
						<div class="status-indicator" class:connected={isConnected}></div>
						<span>VR Device: {isConnected ? 'Connected' : 'Disconnected'}</span>
					</div>
				</div>
			</div>
		</div>
	</div>
{:else}
	<div class="error-container">
		<Header />
		<div class="error">
			<h2>Content Not Found</h2>
			<p>The requested content could not be found.</p>
			<button onclick={goBack}>
				Go Back
			</button>
		</div>
	</div>
{/if}

<style>
	.content-page {
		min-height: 100vh;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 40px 20px;
	}

	.back-button {
		display: flex;
		align-items: center;
		gap: 8px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: white;
		padding: 12px 20px;
		border-radius: 8px;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.2s ease;
		margin-bottom: 30px;
	}

	.back-button:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.content-details {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 40px;
		align-items: start;
	}

	.content-media {
		position: relative;
		border-radius: 12px;
		overflow: hidden;
		background: rgba(0, 0, 0, 0.3);
	}

	.content-image {
		width: 100%;
		height: auto;
		display: block;
		border-radius: 12px;
	}

	.placeholder-image {
		aspect-ratio: 16/9;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(45deg, #333, #555);
		color: rgba(255, 255, 255, 0.6);
		font-size: 1.1rem;
	}

	.media-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.content-media:hover .media-overlay {
		opacity: 1;
	}

	.play-button {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		background: rgba(255, 255, 255, 0.9);
		border: none;
		border-radius: 12px;
		padding: 20px 24px;
		color: #333;
		cursor: pointer;
		transition: all 0.2s ease;
		font-weight: 600;
	}

	.play-button:hover:not(:disabled) {
		background: white;
		transform: scale(1.05);
	}

	.play-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.content-info {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.content-header h1 {
		font-size: 2.5rem;
		font-weight: 700;
		margin: 0 0 16px 0;
		line-height: 1.2;
	}

	.content-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
	}

	.category,
	.duration,
	.file-size {
		display: flex;
		align-items: center;
		gap: 6px;
		background: rgba(255, 255, 255, 0.1);
		padding: 6px 12px;
		border-radius: 16px;
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.9);
	}

	.description h3,
	.tags h3 {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0 0 12px 0;
		color: rgba(255, 255, 255, 0.9);
	}

	.description p {
		font-size: 1rem;
		line-height: 1.6;
		color: rgba(255, 255, 255, 0.8);
		margin: 0;
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.tag {
		background: rgba(255, 255, 255, 0.15);
		padding: 4px 12px;
		border-radius: 12px;
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.9);
	}

	.actions {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
	}

	.btn-primary,
	.btn-secondary {
		padding: 14px 28px;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		text-decoration: none;
		display: inline-block;
		text-align: center;
	}

	.btn-primary {
		background: #4ade80;
		border: none;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #22c55e;
		transform: translateY(-2px);
	}

	.btn-primary:disabled {
		background: #6b7280;
		cursor: not-allowed;
		transform: none;
	}

	.btn-secondary {
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: white;
	}

	.btn-secondary:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.3);
		transform: translateY(-2px);
	}

	.connection-status {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.9rem;
		color: rgba(255, 255, 255, 0.7);
	}

	.status-indicator {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #ef4444;
		transition: background 0.2s ease;
	}

	.status-indicator.connected {
		background: #22c55e;
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
		.container {
			padding: 20px;
		}

		.content-details {
			grid-template-columns: 1fr;
			gap: 30px;
		}

		.content-header h1 {
			font-size: 2rem;
		}

		.actions {
			flex-direction: column;
		}

		.btn-primary,
		.btn-secondary {
			width: 100%;
		}
	}
</style>
