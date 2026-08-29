<script>
  import { icons } from "$lib/icons/icons";
  import { globals } from "$lib/stores/+stores.svelte";
  import { getSubfolder } from "$lib/utils/+helpers.svelte";
  import { page } from '$app/stores';
  import { formatHeadsetId, normalizeHeadsetId } from '$lib/utils/viewerIdentity.js';
  import { getViewerBasePath } from '$lib/utils/viewerRoutes.js';

  let currentClient = $derived(globals.get('currentClient'));
  let clientLocation = $derived($page.params.location || currentClient?.location || null);
  let clientId = $derived(normalizeHeadsetId($page.params.id || currentClient?.id || null));
  let homePath = $derived(
    clientLocation && clientId
      ? getViewerBasePath({ location: clientLocation, id: clientId })
      : `${getSubfolder()}/`
  );
</script>

<div class="mainPageHeader">
  <div class="upperBody">
    <a class="titleLine" href={homePath} aria-label="На главную страницу текущих очков">
      <div class="logo">{@html icons.smallLogo}</div>
      <div class="name">4 Neba VR</div>
    </a>

    <div class="client-name">Очки <b>№ {clientLocation ?? ''}/{formatHeadsetId(clientId)}</b></div>
  </div>
</div>

<style>
  .mainPageHeader {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
  }

  .upperBody {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    max-width: 1200px;
    padding: 1em;
    gap: 0.75em;
    box-sizing: border-box;
  }

  .titleLine {
    display: flex;
    align-items: center;
    color: inherit;
    text-decoration: none;
    cursor: pointer;
  }

  .logo {
    display: flex;
    align-items: center;
  }

  .name {
    font-size: 1.8em;
    font-weight: 500;
    color: var(--color-white);
    margin-bottom: var(--spacing-10);
    line-height: 1.2;
    margin-left: 0.5em;
  }

  .client-name {
    width: 100%;
    display: flex;
    justify-content: flex-start;
    gap: 1em;
    box-sizing: border-box;

    color: var(--color-white-90);
    font-size: 1.125em;
    font-family: var(--ff);
  }
</style>
