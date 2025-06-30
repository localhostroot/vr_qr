<script>
	import { goto } from '$app/navigation';
	import { PUBLIC_VITE_API_URL } from '$env/static/public';
	import { webSocketService } from '$lib/services/websocket.js';
	import { icons } from '$lib/icons/index.js';
	
	let { item, location, id } = $props();

	function getVideoUrl(filePath) {
		if (!filePath) return '';
		
		// If already a full URL, return as-is
		if (filePath.startsWith('http')) {
			return filePath;
		}
		
		// Construct URL with base API URL
		const baseUrl = PUBLIC_VITE_API_URL || 'http://localhost:3001';
		return `${baseUrl}/videos/${filePath}`;
	}

	function getImageUrl(imagePath) {
		if (!imagePath) return '';
		
		// If already a full URL, return as-is
		if (imagePath.startsWith('http')) {
			return imagePath;
		}
		
		// Construct URL with base API URL
		const baseUrl = PUBLIC_VITE_API_URL || 'http://localhost:3001';
		return `${baseUrl}/images/${imagePath}`;
	}

	async function playContent() {
		try {
			const message = {
				type: 'PLAY_CONTENT',
				payload: {
					videoUrl: getVideoUrl(item.path),
					title: item.title,
					id: item.id
				}
			};

			if (webSocketService.isConnected()) {
				webSocketService.send(message);
			} else {
				console.warn('WebSocket not connected, attempting to reconnect...');
				// Optionally attempt to reconnect
				// webSocketService.connect();
			}
		} catch (error) {
			console.error('Failed to play content:', error);
		}
	}

	function viewDetails() {
		goto(`/content/${item.id}`);
	}
</script>

<div class="content-card">
	<div class="card-image">
		{#if item.thumbnail}
			<img 
				src={getImageUrl(item.thumbnail)} 
				alt={item.title}
				loading="lazy"
			/>
		{:else}
			<div class="placeholder-image">
				<span>No Image</span>
			</div>
		{/if}
		
		<div class="card-overlay">
			<button class="play-button" onclick={playContent}>
				{@html icons.play}
			</button>
		</div>
	</div>
	
	<div class="card-content">
		<h3 class="card-title">{item.title}</h3>
		
		{#if item.description}
			<p class="card-description">
				{item.description.length > 100 
					? item.description.substring(0, 100) + '...' 
					: item.description}
			</p>
		{/if}
		
		<div class="card-meta">
			{#if item.duration}
				<span class="duration">
					{@html icons.duration}
					{item.duration}
				</span>
			{/if}
			
			{#if item.category}
				<span class="category">{item.category}</span>
			{/if}
		</div>
		
		<div class="card-actions">
			<button class="btn-play" onclick={playContent}>
				Play on VR
			</button>
			<button class="btn-details" onclick={viewDetails}>
				Details
			</button>
		</div>
	</div>
</div>

<style>
	.content-card {
		background: rgba(255, 255, 255, 0.05);
		border-radius: 12px;
		overflow: hidden;
		transition: all 0.3s ease;
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.content-card:hover {
		transform: translateY(-4px);
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.2);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
	}

	.card-image {
		position: relative;
		width: 100%;
		height: 200px;
		overflow: hidden;
	}

	.card-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.3s ease;
	}

	.content-card:hover .card-image img {
		transform: scale(1.05);
	}

	.placeholder-image {
		width: 100%;
		height: 100%;
		background: linear-gradient(45deg, #333, #555);
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(255, 255, 255, 0.6);
		font-size: 0.9rem;
	}

	.card-overlay {
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

	.content-card:hover .card-overlay {
		opacity: 1;
	}

	.play-button {
		background: rgba(255, 255, 255, 0.9);
		border: none;
		border-radius: 50%;
		width: 60px;
		height: 60px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #333;
		cursor: pointer;
		transition: all 0.2s ease;
		transform: scale(0.8);
	}

	.play-button:hover {
		background: white;
		transform: scale(1);
	}

	.card-content {
		padding: 20px;
		color: white;
	}

	.card-title {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0 0 12px 0;
		line-height: 1.3;
	}

	.card-description {
		color: rgba(255, 255, 255, 0.8);
		font-size: 0.9rem;
		line-height: 1.4;
		margin: 0 0 16px 0;
	}

	.card-meta {
		display: flex;
		align-items: center;
		gap: 16px;
		margin: 0 0 20px 0;
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.6);
	}

	.duration {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.category {
		background: rgba(255, 255, 255, 0.1);
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 0.8rem;
	}

	.card-actions {
		display: flex;
		gap: 12px;
	}

	.btn-play,
	.btn-details {
		flex: 1;
		padding: 10px 16px;
		border: none;
		border-radius: 8px;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-play {
		background: #4ade80;
		color: white;
	}

	.btn-play:hover {
		background: #22c55e;
		transform: translateY(-1px);
	}

	.btn-details {
		background: rgba(255, 255, 255, 0.1);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.btn-details:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.3);
	}

	@media (max-width: 768px) {
		.card-content {
			padding: 16px;
		}

		.card-title {
			font-size: 1.1rem;
		}

		.card-actions {
			flex-direction: column;
		}

		.btn-play,
		.btn-details {
			flex: none;
		}
	}
</style>
