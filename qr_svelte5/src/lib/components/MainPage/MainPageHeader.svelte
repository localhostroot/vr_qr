<script>
  import { icons } from "$lib/icons/icons";
</script>

<div class="mainPageHeader">

  <div class="upperBody">

    <div class="leftUpperBody">

      <div class="titleLine">
        <div class="logo">{@html icons.smallLogo}</div>
        <div class="name">4 Neba VR</div>
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
</div>

<style>
  .mainPageHeader {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 18vh;
    box-sizing: border-box;
  }

  .upperBody {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    max-width: 1200px;
    height: 24vh; /* Reduced height */
    min-height: 100px; /* Minimum height for mobile */
  }

  .leftUpperBody {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    height: 100%;
    min-height: 100%;

    padding: 1em;
    box-sizing: border-box;
  }

  .titleLine {
    display: flex;
  }

  .name {
    font-size: var(--font-responsive-large);
    font-weight: 500;
    color: var(--color-white);
    margin-bottom: var(--spacing-10);
    line-height: 1.2;
    margin-left: 0.5em;
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

</style>
