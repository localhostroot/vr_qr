<script>
  import { page } from '$app/stores';
  import { PUBLIC_APP_SUBFOLDER } from '$env/static/public';
  import { icons } from '$lib/icons/icons.js';
  import { globals } from '$lib/stores/+stores.svelte.js';

  let currentPath = $derived($page.url.pathname);
  let hideNavAndFooter = $derived(PUBLIC_APP_SUBFOLDER ? currentPath === '/new' : currentPath === '/');
  let version = $derived(globals.get('version'));
</script>

{#if !hideNavAndFooter}
<footer class="footer">
  <div class="info">
      <div>ООО "4 НЕБА ВР"</div>
      <div>+7 926 263 16 19</div>
  </div>
  <div class="info">
      <div class="address">г. Москва, вн. тер. г. Муниципальный Округ Новокосино, ул. Новокосинская, д. 23 111673</div>
      <div>ИНН 7720942745</div>
  </div>
  <div class="logos">
      {@html icons.paykeeper}
      {@html icons.visa}
      {@html icons.mastercard}
      <!-- Note: the original project had мир.svg and сбп.svg files, but they seem to be missing. -->
      <!-- You may need to add them to the icons.js file when available -->
  </div>
  <div class="version">v{version}</div>
</footer>
{/if}

<style>
  .footer {
    background-color: var(--color-dark-primary);
    width: 100%;
    margin-top: 5vw;
    position: relative;
    z-index: 101;
    display: flex;
    align-items: center;
    flex-direction: column;
    font-family: 'Montserrat', sans-serif;
    font-weight: 500;
    color: var(--color-white-60);
    font-size: 2.8vw;
    padding-bottom: 20vw;
    gap: 2vw;
  }

  .info {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 88.059vw;
  }

  .address {
    text-align: center;
  }

  .logos {
    display: flex;
    justify-content: center;
    align-items: center;
    max-width: 88.059vw;
    gap: 2vw;
    margin-left: 10px;
  }

  .logos :global(svg) {
    height: 10px;
    width: auto;
  }

  .version {
    font-size: 2.5vw;
    color: var(--color-white-37);
    text-align: center;
    margin-top: var(--spacing-10);
  }
</style>
