<script>
  import { globals } from '$lib/stores/+stores.svelte.js';
  import { goto } from '$app/navigation';
  import { icons } from '$lib/icons/icons.js';
  import { getSubfolder } from '$lib/utils/+helpers.svelte';
  
  let { library } = $props();

  let currentSlideIndex = $derived(globals.get('currentSlideIndex'));
  let sliderContainer = $state();

  // Scroll to current slide when index changes
  $effect(() => {
    if (sliderContainer && library && library.length > 0) {
      const slideWidth = sliderContainer.clientWidth;
      const targetScrollLeft = currentSlideIndex * slideWidth;
      
      sliderContainer.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth'
      });
    }
  });

  function handleSlideChange(index) {
    globals.set('currentSlideIndex', index);
  }

  function goToPrevSlide() {
    if (!library || library.length === 0) return;
    
    const newIndex = currentSlideIndex === 0 ? library.length - 1 : currentSlideIndex - 1;
    globals.set('currentSlideIndex', newIndex);
  }

  function goToNextSlide() {
    if (!library || library.length === 0) return;
    
    const newIndex = currentSlideIndex === library.length - 1 ? 0 : currentSlideIndex + 1;
    globals.set('currentSlideIndex', newIndex);
  }

  function addToQueue(item) {
    const queue = globals.get('queue');
    const existsInQueue = queue.some(queueItem => queueItem.id === item.id);
    if (!existsInQueue) {
      globals.update('queue', currentQueue => [...currentQueue, item]);
    }
  }

  function goToContent(item) {

    goto(`${getSubfolder()}/content/${item.route_id}`);
  }
</script>

<div class="slider">
  {#if library && library.length > 0}
    <div class="slider-wrapper">
      <div
        bind:this={sliderContainer}
        class="slider-container"
      >
        {#each library as item, index}
          <div class="slide">
            <div class="content-card">
              <div class="image-container">
                {#if item.image}
                  <img src={item.image} alt={item.title} />
                {:else}
                  <div class="placeholder-image">
                    <span>Нет изображения</span>
                  </div>
                {/if}
              </div>
              
              <div class="card-content">
                <h3>{item.title || item.name}</h3>
                <!-- {#if item.description}
                  <p>{item.description}</p>
                {/if} -->
                <div class="card-actions">
                  <button class="btn-primary" onclick={() => goToContent(item)}>
                    Подробнее
                  </button>
                  <button class="btn-secondary" onclick={() => addToQueue(item)}>
                    В очередь
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
      
      <!-- Navigation Arrows - Fixed Position -->
      {#if library.length > 1}
        <button class="nav-btn nav-btn-left" onclick={goToPrevSlide}>
          {@html icons.arrow}
        </button>
        <button class="nav-btn nav-btn-right" onclick={goToNextSlide}>
          {@html icons.arrow}
        </button>
      {/if}
    </div>
    
    <!-- Slider navigation dots -->
    <div class="slider-dots">
      {#each library as item, index}
        <!-- svelte-ignore a11y_consider_explicit_label -->
        <button 
          class="dot" 
          class:active={index === currentSlideIndex}
          onclick={() => handleSlideChange(index)}
        ></button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .slider {
    width: 100%;
    position: relative;
  }

  .slider-wrapper {
    position: relative;
    width: 100%;
  }

  .slider-container {
    width: 100%;
    overflow-x: hidden;
    overflow-y: visible;
    border-radius: var(--radius-15);
    display: flex;
    scroll-behavior: smooth;
  }

  .slide {
    width: 100%;
    min-width: 100%;
    flex-shrink: 0;
  }

  .content-card {
    display: flex;
    flex-direction: column;
    background: var(--color-white-10);
    border-radius: var(--radius-15);
    overflow: hidden;
    height: 70vh;
  }

  .image-container {
    position: relative;
    width: 100%;
    height: calc(100% - 13rem);
  }

  .content-card img,
  .placeholder-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .placeholder-image {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-white-5);
    color: var(--color-white-50);
  }

  .card-content {
    flex: 1;
    padding: 0 var(--spacing-20) var(--spacing-20);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .card-content h3 {
    font-size: var(--font-20);
    margin-bottom: var(--spacing-10);
    color: var(--color-white);
    font-weight: var(--font-weight-600);
  }

  .card-content p {
    color: var(--color-white-80);
    line-height: 1.6;
    margin-bottom: var(--spacing-20);
    flex: 1;
  }

  .card-actions {
    display: flex;
    gap: var(--spacing-10);
  }

  .btn-primary,
  .btn-secondary {
    padding: var(--spacing-8) var(--spacing-15);
    border-radius: var(--radius-25);
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: var(--font-10);
    transition: var(--transition-300);
  }

  .btn-primary {
    background: var(--color-white-90);
    color: var(--color-dark-primary);
  }

  .btn-primary:hover {
    background: var(--color-white);
    transform: var(--transform-hover-lift-2);
  }

  .btn-secondary {
    background: transparent;
    color: var(--color-white);
    border: 2px solid var(--color-white-50);
  }

  .btn-secondary:hover {
    background: var(--color-white-10);
    border-color: var(--color-white-80);
  }

  .slider-dots {
    display: flex;
    justify-content: center;
    gap: var(--spacing-5);
    margin-top: var(--spacing-20);
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: var(--radius-full);
    border: none;
    background: var(--color-white-30);
    cursor: pointer;
    transition: var(--transition-300);
  }

  .dot.active {
    background: var(--color-white-90);
    transform: var(--transform-scale-12);
  }

  .dot:hover {
    background: var(--color-white-60);
  }

  /* Navigation Buttons */
  .nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: var(--color-white-10);
    border: none;
    border-radius: var(--radius-full);
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: var(--transition-100);
    backdrop-filter: var(--blur-backdrop);
    z-index: 20;
    /* Position relative to the image area */
    margin-top: calc(-13rem / 2); /* Offset for card-content height */
    border: 1px solid var(--color-white-30);
  }

  .nav-btn:hover {
    background: var(--color-white-20);
    transform: translateY(-50%) scale(1.1);
  }

  .nav-btn:active {
    transform: translateY(-50%) scale(1.05);
  }

  .nav-btn-left {
    left: 16px;
  }

  .nav-btn-right {
    right: 16px;
    transform: translateY(-50%) scaleX(-1);
    margin-top: calc(-13rem / 2); /* Offset for card-content height */
  }

  .nav-btn-right:hover {
    transform: translateY(-50%) scaleX(-1) scale(1.1);
  }

  .nav-btn-right:active {
    transform: translateY(-50%) scaleX(-1) scale(1.05);
  }

  .nav-btn :global(svg) {
    width: 16px;
    height: 16px;
  }
</style>
