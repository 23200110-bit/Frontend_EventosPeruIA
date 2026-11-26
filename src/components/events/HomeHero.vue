<script setup>
import { ref } from 'vue'

defineEmits(['explore'])

const coverUrl =
  'https://rtfayqrbtfiqvpahhavt.supabase.co/storage/v1/object/public/eventos-portadas/Portadaeventos.jpg'
const coverFailed = ref(false)
</script>

<template>
  <section class="home-hero" aria-labelledby="home-hero-title">
    <img
      v-if="coverUrl && !coverFailed"
      :src="coverUrl"
      alt=""
      class="home-hero__photo"
      @error="coverFailed = true"
    />

    <div class="home-hero__content">
      <div>
        <h1 id="home-hero-title">
          Descubre y vive los <em>mejores eventos del Perú</em>
        </h1>
        <p>Encuentra conciertos, talleres y ferias. Elige tu próximo plan y consigue tus entradas.</p>

        <button class="home-hero__explore" type="button" @click="$emit('explore')">
          <q-icon name="search" size="20px" aria-hidden="true" />
          Explorar eventos
        </button>
      </div>

      <div class="home-hero__assistant">
        <h2><q-icon name="auto_awesome" aria-hidden="true" /> Asistente IA</h2>
        <div class="home-hero__example">
          <small>Ejemplo de pregunta</small>
          <p>¿Qué conciertos hay en Lima este fin de semana?</p>
        </div>
        <router-link class="home-hero__assistant-link" :to="{ name: 'assistant' }">
          Abrir asistente
          <q-icon name="arrow_forward" size="18px" aria-hidden="true" />
        </router-link>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  color: #f7f5ff;
  background:
    radial-gradient(ellipse at 78% 32%, #2d2987 0%, transparent 59%),
    linear-gradient(135deg, #0a102b 10%, #15235b 68%, #111535);
}

.home-hero__photo {
  position: absolute;
  inset: 0;
  z-index: -2;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 46%;
  opacity: 1;
}

.home-hero::before {
  position: absolute;
  inset: 0;
  z-index: -1;
  content: '';
  background:
    linear-gradient(0deg, var(--blue-deep) 0%, #0a1029a6 14%, transparent 36%),
    linear-gradient(90deg, #080d26f5 0%, #0c1330d6 28%, #11163a52 58%, #120f4366 100%);
}

.home-hero__content {
  width: min(1140px, calc(100% - 48px));
  min-height: 530px;
  margin: 0 auto;
  padding: clamp(54px, 7vw, 105px) 0;
  display: grid;
  grid-template-columns: minmax(0, 1.42fr) minmax(0, 1fr);
  gap: clamp(28px, 6vw, 92px);
  align-items: center;
}

.home-hero h1 {
  max-width: 17ch;
  margin: 0;
  font-family: system-ui, sans-serif;
  font-size: clamp(42px, 5.05vw, 72px);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.045em;
  text-wrap: balance;
}

.home-hero h1 em {
  color: #ffdaa8;
  font-style: normal;
}

.home-hero__content > div:first-child > p {
  max-width: 44ch;
  margin: 22px 0 28px;
  color: #dfdff7;
  font-size: clamp(15px, 1.52vw, 19px);
  line-height: 1.6;
}

.home-hero__explore,
.home-hero__assistant-link {
  display: inline-flex;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 17px;
  border: 1px solid transparent;
  border-radius: 10px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.home-hero__explore {
  color: #22203f;
  background: #ffd499;
}

.home-hero__explore:hover {
  background: #ffe4bd;
}

.home-hero__assistant {
  padding: clamp(18px, 3vw, 29px);
  border: 1px solid #acaaff67;
  border-radius: 20px;
  background: linear-gradient(145deg, #202b6ef5, #21184cf7);
  box-shadow: 0 18px 56px #04071b75;
}

.home-hero__assistant h2 {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 18px;
  font-size: 20px;
  font-weight: 750;
  letter-spacing: normal;
  line-height: 1.25;
}

.home-hero__assistant h2 .q-icon {
  color: #c9b4ff;
}

.home-hero__example {
  padding: 16px;
  border: 1px solid #9b94ff50;
  border-radius: 12px;
  background: #333585;
}

.home-hero__example small {
  color: #ded8ff;
}

.home-hero__example p {
  margin: 6px 0 0;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.45;
}

.home-hero__assistant-link {
  margin-top: 18px;
  color: #fff;
  background: #5941c0;
  text-decoration: none;
}

.home-hero__assistant-link:hover {
  background: #684cd6;
}

.home-hero :is(button, a):focus-visible {
  outline: 2px solid #ffdaa8;
  outline-offset: 4px;
}

@media (max-width: 760px) {
  .home-hero::before {
    background: linear-gradient(180deg, #080d26bd 0%, #0a102986 48%, var(--blue-deep) 100%);
  }

  .home-hero__content {
    width: calc(100% - 36px);
    min-height: auto;
    grid-template-columns: minmax(0, 1fr);
    gap: 30px;
    padding: 48px 0;
  }

  .home-hero h1 {
    font-size: clamp(36px, 9vw, 56px);
  }
}
</style>
