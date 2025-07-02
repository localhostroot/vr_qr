<div class="loader-container">
  <div class="loader">
    <div class="spinner"></div>
    <div class="text">Загрузка...</div>
  </div>
</div>

<style>
  .loader-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 50vh;
    width: 100%;
  }

  .loader {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-left: 4px solid #ffffff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .text {
    color: rgba(255, 255, 255, 0.7);
    font-size: 1.1rem;
    font-family: 'Montserrat', sans-serif;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
