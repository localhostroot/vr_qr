<script>
  let { scrollFunc } = $props();
</script>

<div class="mainPageHeader">
  <div class="upperBody">
    <div class="leftUpperBody">
      <div class="name">
        4 Neba VR
      </div>
      <div class="initInstructions">
        <div class="firstParagraph">
          учись и путешествуй в виртуальной реальности.
        </div>
        <div class="secondParagraph">
          выбери фильм, оплати, и наслаждайся просмотром
        </div>
      </div>
    </div>
    <div class="rightUpperBody">
      <div class="rectangle" style="width: 0.4975vw;"></div>
      <div class="rectangle" style="width: 0.995vw;"></div>
      <div class="rectangle" style="width: 1.743vw;"></div>
      <div class="rectangle" style="width: 3.7313vw;"></div>
      <div class="rectangle" style="width: 6.219vw;"></div>
      <div class="rectangle" style="width: 8.209vw;"></div>
      <div class="rectangle" style="width: 8.209vw;"></div>
    </div>
  </div>
  <div class="bottomBody" onclick={scrollFunc}>
    Посмотреть фильмы
  </div>
</div>

<style>
  .mainPageHeader {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: calc(100vh - var(--navigation-height));
    box-sizing: border-box;
  }

  .upperBody {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    max-width: 1200px;

    height: calc(100vh - var(--navigation-height) - 120px);
  }

  .leftUpperBody {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: end;
    height: 100%;
    min-height: 100%;

    padding: 0 2em;
    box-sizing: border-box;
  }

  .name {
    font-size: var(--font-responsive-large);
    font-weight: 500;
    color: var(--color-white);
    margin-bottom: var(--spacing-10);
    line-height: 1.2;
  }

  .initInstructions {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-5);
    max-width: var(--container-600);
  }

  .firstParagraph,
  .secondParagraph {
    color: var(--color-white-90);
    font-size: var(--font-responsive-small);
    line-height: 1.4;
  }

  .secondParagraph {
    color: var(--color-white-60);
  }

  .rightUpperBody {
    display: flex;
    align-items: flex-end;
    gap: var(--spacing-vw-5);
    height: 100%;
    min-height: 100%;
  }

  .rectangle {
    background: linear-gradient(180deg, var(--color-white) 0%, var(--color-white-50) 100%);
    height: 100%;
    min-height: 100%;
    border-radius: var(--spacing-vw-5);
  }

  .bottomBody {
    background: var(--color-white-80);
    padding: var(--spacing-10) var(--spacing-20);
    border-radius: var(--radius-30);
    color: var(--color-dark-80);
    font-size: var(--font-11);
    cursor: pointer;
    transition: var(--transition-300);
    margin-bottom: 2rem;
  }

  .bottomBody:hover {
    background: var(--color-white-90);
    transform: var(--transform-hover-lift-2);
  }
</style>
