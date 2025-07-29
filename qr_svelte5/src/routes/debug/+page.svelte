<script>
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	let copyStatus = '';

	function clipboard(content) {
		const el = document.createElement('textarea');
		el.value = content;
		document.body.appendChild(el);
		el.select();
		document.execCommand('copy');
		document.body.removeChild(el);
	}

	async function copyLocalStorageToClipboard() {
		if (!browser) {
			copyStatus = 'Error: Not available on server-side';
			return;
		}

		try {
			// Get all localStorage items
			const localStorageData = {};
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key) {
					try {
						// Try to parse as JSON first, if it fails, store as string
						const value = localStorage.getItem(key);
						try {
							localStorageData[key] = JSON.parse(value);
						} catch {
							localStorageData[key] = value;
						}
					} catch (error) {
						localStorageData[key] = `Error reading key: ${error.message}`;
					}
				}
			}

			// Convert to formatted JSON string
			const jsonString = JSON.stringify(localStorageData, null, 2);

			// Copy to clipboard
			clipboard(jsonString);
			
			copyStatus = 'Successfully copied localStorage to clipboard!';
			
			// Clear status after 3 seconds
			setTimeout(() => {
				copyStatus = '';
			}, 3000);

		} catch (error) {
			copyStatus = `Error: ${error.message}`;
			setTimeout(() => {
				copyStatus = '';
			}, 3000);
		}
	}
</script>

<svelte:head>
	<title>Debug - VR QR</title>
</svelte:head>

<div class="debug-container">
	<h1>Debug Tools</h1>
	
	<div class="button-section">
		<button 
			on:click={copyLocalStorageToClipboard}
			class="copy-button"
			disabled={!browser}
		>
			Copy localStorage JSON to Clipboard
		</button>
		
		{#if copyStatus}
			<div class="status-message" class:success={copyStatus.includes('Successfully')} class:error={copyStatus.includes('Error')}>
				{copyStatus}
			</div>
		{/if}
	</div>
</div>

<style>
	.debug-container {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	h1 {
		color: #333;
		margin-bottom: 2rem;
		text-align: center;
	}

	.button-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.copy-button {
		background: #007bff;
		color: white;
		border: none;
		padding: 12px 24px;
		border-radius: 6px;
		font-size: 16px;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.copy-button:hover:not(:disabled) {
		background: #0056b3;
	}

	.copy-button:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.status-message {
		padding: 8px 16px;
		border-radius: 4px;
		font-weight: 500;
		text-align: center;
	}

	.status-message.success {
		background: #d4edda;
		color: #155724;
		border: 1px solid #c3e6cb;
	}

	.status-message.error {
		background: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
	}
</style>
