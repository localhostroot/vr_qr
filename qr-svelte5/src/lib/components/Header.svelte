<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	
	let currentPath = $derived($page.url.pathname);
</script>

<header class="header">
	<div class="container">
		<div class="logo" onclick={() => goto('/')} role="button" tabindex="0">
			<img src="/images/logo.svg" alt="VR Logo" />
			<span>VR Control</span>
		</div>
		
		<nav class="nav">
			<a href="/" class:active={currentPath === '/'}>
				Home
			</a>
			<a href="/queue" class:active={currentPath === '/queue'}>
				Queue
			</a>
			<a href="/films" class:active={currentPath === '/films'}>
				Films
			</a>
		</nav>
	</div>
</header>

<style>
	.header {
		background: rgba(0, 0, 0, 0.9);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem 2rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		transition: opacity 0.2s ease;
	}

	.logo:hover {
		opacity: 0.8;
	}

	.logo img {
		width: 32px;
		height: 32px;
	}

	.logo span {
		font-size: 1.25rem;
		font-weight: 600;
		color: white;
	}

	.nav {
		display: flex;
		gap: 2rem;
	}

	.nav a {
		color: rgba(255, 255, 255, 0.7);
		text-decoration: none;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		transition: all 0.2s ease;
		font-weight: 500;
	}

	.nav a:hover {
		color: white;
		background: rgba(255, 255, 255, 0.1);
	}

	.nav a.active {
		color: #4ade80;
		background: rgba(74, 222, 128, 0.1);
	}

	@media (max-width: 768px) {
		.container {
			padding: 0.75rem 1rem;
		}

		.nav {
			gap: 1rem;
		}

		.nav a {
			padding: 0.25rem 0.5rem;
			font-size: 0.875rem;
		}

		.logo span {
			font-size: 1rem;
		}
	}
</style>
