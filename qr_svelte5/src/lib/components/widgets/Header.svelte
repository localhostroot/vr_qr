<script>
  import { icons } from '$lib/icons/icons.js';
</script>

<header class="header">
  <div class="logo">
    {@html icons.smallLogo}
  </div>
</header>

<style>
  .header {
    width: fit-content;
    display: flex;
    position: absolute;
    top: 2.48756vw;
    left: 2.48756vw;
    z-index: 100;
  }

  .logo {
    color: white;
  }
</style>
