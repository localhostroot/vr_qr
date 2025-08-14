<script>
	import { BarChart3, TrendingUp, TrendingDown } from 'lucide-svelte';

	let {
		title = '',
		value = 0,
		subtitle = '',
		trend = null,
		trendValue = null,
		icon = BarChart3,
		color = 'blue'
	} = $props();

	// Format large numbers
	function formatNumber(num) {
		// Handle string values (like "$123.45")
		if (typeof num === 'string') {
			return num;
		}
		
		if (num >= 1000000) {
			return (num / 1000000).toFixed(1) + 'M';
		} else if (num >= 1000) {
			return (num / 1000).toFixed(1) + 'K';
		}
		return num.toLocaleString();
	}

	// Derived state for trend icon
	let TrendIcon = $derived(trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null);
</script>

<div class="stats-card {color}">
	<div class="stats-header">
		<div class="icon-container {color}">
			<svelte:component this={icon} class="icon" />
		</div>
		<h3 class="title">{title}</h3>
	</div>

	<div class="value-section">
		<div class="value">
			{formatNumber(value)}
		</div>
		{#if subtitle}
			<p class="subtitle">{subtitle}</p>
		{/if}
	</div>

	{#if trend && trendValue}
		<div class="trend-section {trend}">
			{#if TrendIcon}
				<svelte:component this={TrendIcon} class="trend-icon" />
			{/if}
			<span class="trend-value">
				{trendValue > 0 ? '+' : ''}{trendValue}%
			</span>
			<span class="trend-label">vs last period</span>
		</div>
	{/if}
</div>

<style>
	.stats-card {
		background: var(--color-white);
		border-radius: var(--radius-15);
		padding: var(--spacing-20);
		box-shadow: 0 2px 10px var(--color-dark-30);
		transition: var(--transition-200);
		border-left: 4px solid var(--color-blue);
	}

	.stats-card:hover {
		transform: var(--transform-hover-lift-2);
		box-shadow: 0 10px 25px var(--color-dark-30);
	}

	.stats-card.blue {
		border-left-color: var(--color-blue);
	}

	.stats-card.green {
		border-left-color: var(--color-success);
	}

	.stats-card.red {
		border-left-color: var(--color-error);
	}

	.stats-card.purple {
		border-left-color: #6366f1;
	}

	.stats-card.yellow {
		border-left-color: #f59e0b;
	}

	.stats-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-10);
		margin-bottom: var(--spacing-15);
	}

	.icon-container {
		padding: var(--spacing-8);
		border-radius: var(--radius-10);
		background: var(--color-info-10);
	}

	.icon-container.blue {
		background: var(--color-info-10);
	}

	.icon-container.green {
		background: var(--color-success-10);
	}

	.icon-container.red {
		background: var(--color-error-10);
	}

	.icon-container.purple {
		background: rgba(99, 102, 241, 0.1);
	}

	.icon-container.yellow {
		background: rgba(245, 158, 11, 0.1);
	}

	.icon {
		width: 24px;
		height: 24px;
		color: var(--color-blue);
	}

	.blue .icon {
		color: var(--color-blue);
	}

	.green .icon {
		color: var(--color-success);
	}

	.red .icon {
		color: var(--color-error);
	}

	.purple .icon {
		color: #6366f1;
	}

	.yellow .icon {
		color: #f59e0b;
	}

	.title {
		font-size: var(--font-9);
		font-weight: var(--font-weight-500);
		color: var(--color-dark-50);
		margin: 0;
	}

	.value-section {
		margin-bottom: var(--spacing-10);
	}

	.value {
		font-size: var(--font-vw-30);
		font-weight: var(--font-weight-bold);
		color: var(--color-dark-primary);
		margin-bottom: var(--spacing-5);
	}

	.subtitle {
		font-size: var(--font-8);
		color: var(--color-dark-50);
		margin: 0;
	}

	.trend-section {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
	}

	.trend-section.up {
		color: var(--color-success);
	}

	.trend-section.down {
		color: var(--color-error);
	}

	.trend-icon {
		width: 16px;
		height: 16px;
	}

	.trend-value {
		font-size: var(--font-8);
		font-weight: var(--font-weight-500);
	}

	.trend-label {
		font-size: var(--font-8);
		color: var(--color-dark-50);
	}

	@media (max-width: 768px) {
		.value {
			font-size: var(--font-20);
		}
	}
</style>
