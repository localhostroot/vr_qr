<script>
  import { goto } from '$app/navigation';

  let { item } = $props();

  function handleClick() {
    goto(`/film/${item.route_id}`);
  }
</script>

<div class="table-element" onclick={handleClick}>
  <div class="back-img">
    <img src={item.image} alt="серия" />
  </div>
  <div class="info">
    <div class="upper-info">
      <div class="name">
        <div class="film-name">{item.name}</div>
        <div class="number">{item.number} серия</div>
      </div>
      <div class="time">
        {item.time}
      </div>
    </div>
    <div class="price">
      {item.price}₽
    </div>
  </div>
</div>

<style>
  .table-element {
    display: flex;
    width: 100%;
    border-radius: 5px;
    font-family: "Manrope", serif;
    align-items: stretch;
    cursor: pointer;
  }

  .back-img {
    position: relative;
    width: 46.268vw;
    flex-shrink: 0;
  }

  .back-img img {
    width: 100%;
    height: auto;
    display: block;
  }

  .info {
    display: flex;
    flex-direction: column;
    width: calc(100% - 46.268vw);
    background: #212121;
    justify-content: space-between;
  }

  .upper-info {
    display: flex;
    justify-content: space-between;
    margin-top: 2.48756vw;
  }

  .name {
    display: flex;
    flex-direction: column;
    gap: 2.48756vw;
    margin-left: 2.48756vw;
  }

  .film-name {
    font-weight: 400;
    color: white;
    font-size: 3.48258vw;
  }

  .number {
    font-weight: 400;
    color: rgba(255, 255, 255, 0.65);
    font-size: 2.985vw;
  }

  .time {
    font-weight: 400;
    color: rgba(255, 255, 255, 0.65);
    font-size: 2.985vw;
    margin-right: 2.48756vw;
  }

  .price {
    margin-left: 2.48756vw;
    margin-bottom: 2.48756vw;
    font-weight: 400;
    color: white;
    font-size: 3.48258vw;
    padding-left: 5px;
    padding-right: 5px;
    border-bottom: 1px solid white;
    width: fit-content;
  }
</style>
