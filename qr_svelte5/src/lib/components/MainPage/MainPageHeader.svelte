<script>
  import { globals } from "$lib/stores/+stores.svelte";
  import { page } from '$app/stores';
  import { formatHeadsetId, normalizeHeadsetId } from '$lib/utils/viewerIdentity.js';

  let currentClient = $derived(globals.get('currentClient'));
  let clientLocation = $derived($page.params.location || currentClient?.location || null);
  let clientId = $derived(normalizeHeadsetId($page.params.id || currentClient?.id || null));
</script>

<div class="mainPageHeader">
  <div class="upperBody">
    <div class="client-name">Очки <b>{clientLocation ?? ''}/{formatHeadsetId(clientId)}</b></div>
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
    padding: 0.75em 1em 0.35em;
    box-sizing: border-box;
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
