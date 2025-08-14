<script>
	import { onMount, onDestroy } from 'svelte';
	import {
		Chart,
		CategoryScale,
		LinearScale,
		PointElement,
		LineElement,
		BarElement,
		Title,
		Tooltip,
		Legend,
		ArcElement
	} from 'chart.js';

	// Register Chart.js components
	Chart.register(
		CategoryScale,
		LinearScale,
		PointElement,
		LineElement,
		BarElement,
		Title,
		Tooltip,
		Legend,
		ArcElement
	);

	// Props
	let {
		type = 'line',
		data,
		options = {},
		width = 400,
		height = 200,
		className = ''
	} = $props();

	let canvas;
	let chart;

	// Default options
	const defaultOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				position: 'top'
			}
		}
	};

	// Create chart
	function createChart() {
		if (canvas && data) {
			if (chart) {
				chart.destroy();
			}
			
			const ctx = canvas.getContext('2d');
			const mergedOptions = { ...defaultOptions, ...options };
			chart = new Chart(ctx, {
				type,
				data,
				options: mergedOptions
			});
		}
	}

	// Update chart when data changes
	$effect(() => {
		if (chart && data) {
			chart.data = data;
			chart.update();
		} else {
			createChart();
		}
	});

	onMount(() => {
		createChart();
	});

	onDestroy(() => {
		if (chart) {
			chart.destroy();
		}
	});
</script>

<div class="chart-container {className}" style="width: {width}px; height: {height}px;">
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.chart-container {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	canvas {
		max-width: 100%;
		max-height: 100%;
	}
</style>
