<script>
  import TableElement from './TableElement.svelte';

  let { item, series } = $props();
</script>

<div class="serial-table">
  <div class="header">
    <div class="name">
      ВСЕ СЕРИИ
    </div>
    <div class="series">
      {series}
    </div>
  </div>
  <div class="list">
    {#each item as i (i.id)}
      <TableElement item={i} />
    {/each}
  </div>
</div>

<style>
  .serial-table {
    width: 100%;
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 6.2189vw;
  }

  .header {
    width: 95.02487vw;
    display: flex;
    justify-content: space-between;
  }

  .name {
    font-family: "Montserrat", serif;
    font-weight: 500;
    font-size: 4.4776vw;
    color: white;
  }

  .series {
    font-weight: 400;
    font-family: "Manrope", serif;
    font-size: 3.48259vw;
    color: rgba(255, 255, 255, 0.7);
  }

  .list {
    width: 95.02487vw;
    display: flex;
    flex-direction: column;
    gap: 2.48756vw;
  }
</style>
