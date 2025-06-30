<footer class="footer">
	<div class="container">
		<div class="footer-content">
			<div class="logo-section">
				<img src="/images/logo.svg" alt="VR Logo" />
				<span>VR Control Interface</span>
			</div>
			
			<div class="links-section">
				<a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy</a>
				<a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>
				<a href="/support" target="_blank" rel="noopener noreferrer">Support</a>
			</div>
		</div>
		
		<div class="copyright">
			<p>&copy; {new Date().getFullYear()} VR Control Interface. All rights reserved.</p>
		</div>
	</div>
</footer>

<style>
	.footer {
		background: rgba(0, 0, 0, 0.95);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		margin-top: auto;
		padding: 1rem 0;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 2rem;
	}

	.footer-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.logo-section {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.logo-section img {
		width: 24px;
		height: 24px;
		opacity: 0.8;
	}

	.logo-section span {
		font-size: 1rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.8);
	}

	.links-section {
		display: flex;
		gap: 2rem;
	}

	.links-section a {
		color: rgba(255, 255, 255, 0.6);
		text-decoration: none;
		font-size: 0.875rem;
		transition: color 0.2s ease;
	}

	.links-section a:hover {
		color: rgba(255, 255, 255, 0.9);
	}

	.copyright {
		text-align: center;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}

	.copyright p {
		margin: 0;
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.4);
	}

	@media (max-width: 768px) {
		.container {
			padding: 0 1rem;
		}

		.footer-content {
			flex-direction: column;
			gap: 1rem;
			text-align: center;
		}

		.links-section {
			gap: 1.5rem;
		}
	}
</style>
