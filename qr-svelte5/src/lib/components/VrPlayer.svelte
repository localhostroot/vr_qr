<script>
	import { onMount, onDestroy } from 'svelte';
	import { webSocketService } from '$lib/services/websocket.js';
	import { globals } from '$lib/+stores.svelte.js';
	import { icons } from '$lib/icons/index.js';

	let { location, id } = $props();

	// Player state
	let isPlaying = $state(false);
	let currentContent = $state(null);
	let volume = $state(50);
	let currentTime = $state(0);
	let duration = $state(0);
	let isConnected = $state(false);

	// WebSocket connection status
	let unsubscribe;

	onMount(() => {
		// Subscribe to WebSocket connection status
		unsubscribe = webSocketService.subscribe((message) => {
			handleWebSocketMessage(message);
		});

		// Check initial connection status
		isConnected = webSocketService.isConnected();

		// Listen for connection state changes
		const checkConnection = setInterval(() => {
			isConnected = webSocketService.isConnected();
		}, 1000);

		return () => {
			clearInterval(checkConnection);
		};
	});

	onDestroy(() => {
		if (unsubscribe) {
			unsubscribe();
		}
	});

	function handleWebSocketMessage(message) {
		if (!message) return;

		switch (message.type) {
			case 'CONTENT_LOADED':
				currentContent = message.payload;
				break;

			case 'PLAYBACK_STATE':
				isPlaying = message.payload.isPlaying;
				currentTime = message.payload.currentTime || 0;
				duration = message.payload.duration || 0;
				break;

			case 'VOLUME_CHANGED':
				volume = message.payload.volume;
				break;

			case 'CONTENT_ENDED':
				isPlaying = false;
				currentTime = 0;
				break;

			case 'ERROR':
				console.error('VR Player error:', message.payload);
				break;
		}
	}

	function togglePlayPause() {
		const message = {
			type: isPlaying ? 'PAUSE_CONTENT' : 'RESUME_CONTENT',
			payload: {}
		};
		webSocketService.send(message);
	}

	function stopContent() {
		const message = {
			type: 'STOP_CONTENT',
			payload: {}
		};
		webSocketService.send(message);
		isPlaying = false;
		currentContent = null;
		currentTime = 0;
		duration = 0;
	}

	function changeVolume(newVolume) {
		volume = newVolume;
		const message = {
			type: 'SET_VOLUME',
			payload: { volume: newVolume }
		};
		webSocketService.send(message);
	}

	function seekTo(time) {
		currentTime = time;
		const message = {
			type: 'SEEK_TO',
			payload: { time }
		};
		webSocketService.send(message);
	}

	function formatTime(seconds) {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	// Calculate progress percentage
	let progress = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);
</script>

{#if currentContent}
	<div class="vr-player" class:connected={isConnected}>
		<div class="player-header">
			<div class="content-info">
				<h3>{currentContent.title}</h3>
				<p>Playing on VR Device: {location}:{id}</p>
			</div>
			
			<div class="connection-status">
				<div class="status-indicator" class:connected={isConnected}></div>
				<span>{isConnected ? 'Connected' : 'Disconnected'}</span>
			</div>
		</div>

		<div class="progress-section">
			<div class="time-info">
				<span>{formatTime(currentTime)}</span>
				<span>{formatTime(duration)}</span>
			</div>
			
			<div 
				class="progress-bar" 
				onclick={(e) => {
					if (duration > 0) {
						const rect = e.currentTarget.getBoundingClientRect();
						const clickX = e.clientX - rect.left;
						const percentage = clickX / rect.width;
						const newTime = percentage * duration;
						seekTo(newTime);
					}
				}}
			>
				<div class="progress-fill" style="width: {progress}%"></div>
				<div class="progress-handle" style="left: {progress}%"></div>
			</div>
		</div>

		<div class="controls">
			<div class="playback-controls">
				<button 
					class="control-btn" 
					onclick={togglePlayPause}
					disabled={!isConnected}
				>
					{#if isPlaying}
						{@html icons.pause}
					{:else}
						{@html icons.play}
					{/if}
				</button>

				<button 
					class="control-btn stop-btn" 
					onclick={stopContent}
					disabled={!isConnected}
				>
					{@html icons.stop}
				</button>
			</div>

			<div class="volume-control">
				{@html icons.volume}
				
				<input
					type="range"
					min="0"
					max="100"
					bind:value={volume}
					onchange={(e) => changeVolume(parseInt(e.target.value))}
					disabled={!isConnected}
					class="volume-slider"
				/>
				
				<span class="volume-value">{volume}%</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.vr-player {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: rgba(0, 0, 0, 0.95);
		backdrop-filter: blur(20px);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		padding: 20px;
		color: white;
		z-index: 1000;
		transform: translateY(100%);
		transition: transform 0.3s ease;
	}

	.vr-player.connected {
		transform: translateY(0);
	}

	.player-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 16px;
	}

	.content-info h3 {
		font-size: 1.1rem;
		font-weight: 600;
		margin: 0 0 4px 0;
	}

	.content-info p {
		font-size: 0.9rem;
		color: rgba(255, 255, 255, 0.7);
		margin: 0;
	}

	.connection-status {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.8);
	}

	.status-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #ef4444;
		transition: background 0.2s ease;
	}

	.status-indicator.connected {
		background: #22c55e;
	}

	.progress-section {
		margin-bottom: 16px;
	}

	.time-info {
		display: flex;
		justify-content: space-between;
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.7);
		margin-bottom: 8px;
	}

	.progress-bar {
		position: relative;
		height: 6px;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		cursor: pointer;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: #4ade80;
		border-radius: 3px;
		transition: width 0.1s ease;
	}

	.progress-handle {
		position: absolute;
		top: 50%;
		width: 12px;
		height: 12px;
		background: white;
		border-radius: 50%;
		transform: translate(-50%, -50%);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.progress-bar:hover .progress-handle {
		opacity: 1;
	}

	.controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.playback-controls {
		display: flex;
		gap: 12px;
	}

	.control-btn {
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: white;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.control-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.control-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.stop-btn {
		background: rgba(239, 68, 68, 0.2);
		border-color: rgba(239, 68, 68, 0.3);
	}

	.stop-btn:hover:not(:disabled) {
		background: rgba(239, 68, 68, 0.3);
		border-color: rgba(239, 68, 68, 0.4);
	}

	.volume-control {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 200px;
	}

	.volume-slider {
		flex: 1;
		height: 4px;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 2px;
		outline: none;
		cursor: pointer;
	}

	.volume-slider::-webkit-slider-thumb {
		appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: white;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.volume-slider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: white;
		cursor: pointer;
		border: none;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.volume-value {
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.7);
		min-width: 40px;
		text-align: right;
	}

	@media (max-width: 768px) {
		.vr-player {
			padding: 16px;
		}

		.player-header {
			flex-direction: column;
			gap: 8px;
		}

		.controls {
			flex-direction: column;
			gap: 16px;
		}

		.volume-control {
			min-width: auto;
			width: 100%;
		}
	}
</style>
