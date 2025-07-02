<script>
  import HeaderWrapper from './HeaderWrapper.svelte';
  import CardsSlider from './CardsSlider.svelte';
  
  let { library } = $props();

  let instance = $state();

  export const getOffsetTop = () => {
    
    return instance.getBoundingClientRect().y
  }

</script>

<div
  bind:this={instance}
  class="vrPlayer"
>
  <HeaderWrapper />
  <CardsSlider {library} />
</div>

<style>
  .vrPlayer {
    width: 100%;
    min-height: calc(100vh - var(--navigation-height));
    background: var(--color-dark-30);
    padding: var(--spacing-20);
    box-sizing: border-box;
    backdrop-filter: var(--blur-backdrop);
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }
</style>
