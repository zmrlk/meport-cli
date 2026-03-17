<script lang="ts">
  import sygnet from "../assets/sygnet.png";
</script>

<div class="logo-container">
  <div class="glow-ring"></div>
  <img src={sygnet} alt="meport" class="logo" />
</div>

<style>
  .logo-container {
    position: relative;
    width: 96px;
    height: 96px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .glow-ring {
    position: absolute;
    inset: -16px;
    border-radius: 50%;
    animation: glow-pulse 3s ease-in-out infinite;
  }

  .logo {
    width: 80px;
    height: 80px;
    animation: breathing 2.5s ease-in-out infinite;
    filter: drop-shadow(0 0 20px var(--color-accent-glow));
    position: relative;
    z-index: 1;
  }
</style>
