<div class="loader-container">
	<div class="loader">
		<div class="spinner"></div>
		<p>Loading VR devices...</p>
	</div>
</div>

<style>
	.loader-container {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.loader {
		text-align: center;
		color: white;
	}

	.spinner {
		width: 60px;
		height: 60px;
		border: 4px solid rgba(255, 255, 255, 0.2);
		border-top: 4px solid #4ade80;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 20px;
	}

	.loader p {
		font-size: 18px;
		margin: 0;
		opacity: 0.9;
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	@keyframes pulse {
		0%, 100% { opacity: 0.9; }
		50% { opacity: 0.5; }
	}
</style>
