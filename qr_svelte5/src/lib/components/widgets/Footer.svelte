<script>
  import { page } from '$app/stores';
  import { icons } from '$lib/icons/icons.js';

  let currentPath = $derived($page.url.pathname);
  let hideNavAndFooter = $derived(currentPath === '/');
</script>

{#if !hideNavAndFooter}
<footer class="footer">
  <div class="info">
      <div>ООО "4 НЕБА ВР", ИНН 7720942745</div>
  </div>
  <div class="info">
      <div class="address">г. Москва, вн. тер. г. Муниципальный Округ Новокосино, ул. Новокосинская, д. 23 111673, <span class="phone">+7 926 263 16 19</span></div>
  </div>
  <div class="logos">
      {@html icons.paykeeper}
      {@html icons.visa}
      {@html icons.mastercard}
      <!-- Note: the original project had мир.svg and сбп.svg files, but they seem to be missing. -->
      <!-- You may need to add them to the icons.js file when available -->
  </div>
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

  .phone,
  .phone :global(a),
  .footer :global(a[x-apple-data-detectors]) {
    color: inherit !important;
    text-decoration: none !important;
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

</style>
