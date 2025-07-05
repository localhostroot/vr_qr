<script>
  import { icons } from '$lib/icons/icons.js';
  
  let { isVisible } = $props();
  
  // Simple approach - just use CSS transitions based on isVisible
</script>

<div 
  class="start-screen" 
  class:hidden={!isVisible}
>
  <div class="content">
    <div class="title-line" class:exiting={!isVisible}>
      <div class="logo" class:exiting={!isVisible}>
        {@html icons.smallLogo}
      </div>
      <div class="title" class:exiting={!isVisible}>
        4 Neba VR
      </div>
    </div>
    
    <!-- Loading indicator -->
    <div class="loading-indicator" class:exiting={!isVisible}>
      <div class="spinner"></div>
    </div>
  </div>
</div>

<style>
  .start-screen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: var(--color-dark-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999; /* Above everything including FixedNavigation */
    opacity: 1;
    transition: opacity 0.8s ease-out;
  }
  
  .start-screen.hidden {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.8s ease-out;
    transition-delay: 0.25s;
  }
  
  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 3rem;
  }
  
  .title-line {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    transform: scale(1);
    opacity: 1;
    transition: all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }
  
  .logo {
    display: flex;
    align-items: center;
    justify-content: center;
    transform: scale(1);
    opacity: 1;
    transition: all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }
  
  .logo :global(svg) {
    width: 60px;
    height: 60px;
    filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.3));
  }
  
  .title {
    font-size: 2.5rem;
    font-weight: 500;
    color: var(--color-white);
    font-family: 'Montserrat', sans-serif;
    text-shadow: 0 0 30px rgba(255, 255, 255, 0.3);
    transform: scale(1);
    opacity: 1;
    transition: all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }
  
  /* Exit animations */
  .logo.exiting {
    transform: scale(3);
    opacity: 0;
    filter: blur(10px);
  }
  
  .title.exiting {
    transform: scale(2.5);
    opacity: 0;
    filter: blur(8px);
  }
  
  .loading-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    opacity: 0.8;
    transition: opacity 0.4s ease-out;
  }
  
  .loading-indicator.exiting {
    opacity: 0;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top: 3px solid var(--color-white);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  .loading-text {
    color: var(--color-white-70);
    font-size: 1rem;
    font-family: 'Montserrat', sans-serif;
    font-weight: 400;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  /* Mobile responsive */
  @media (max-width: 768px) {
    .logo :global(svg) {
      width: 50px;
      height: 50px;
    }
    
    .title {
      font-size: 2rem;
    }
    
    .content {
      gap: 2rem;
      padding: 1rem;
    }
  }
  
  @media (max-width: 480px) {
    .logo :global(svg) {
      width: 40px;
      height: 40px;
    }
    
    .title {
      font-size: 1.75rem;
    }
    
    .title-line {
      gap: 0.75rem;
    }
  }
</style>
