<template>
  <main>
    <section class="hero pixel-field">
      <div class="hero-inner">
        <p class="eyebrow">OPEN SOURCE AI GAME STUDIO</p>
        <h1>Create games with AI</h1>
        <p class="hero-sub">Describe the game. Watch OpenCode build it live. Publish it to the web.</p>
        <form class="prompt-box" @submit.prevent="create">
          <span class="prompt-icon">✦</span>
          <textarea v-model="prompt" :disabled="loading" rows="1" placeholder="Ask OmGithub to create a 3D football game…" @keydown.enter.exact.prevent="create"></textarea>
          <button :disabled="loading || !prompt.trim()" aria-label="Create game"><span v-if="loading" class="spinner"></span><span v-else>↑</span></button>
        </form>
        <p v-if="error" class="form-error">{{ error }}</p>
        <div class="capabilities">
          <div><b>◎</b><span><strong>Publish</strong><small>Permanent web link</small></span></div>
          <div><b>◈</b><span><strong>Live build</strong><small>Watch OpenCode work</small></span></div>
          <div><b>▣</b><span><strong>Install</strong><small>Ready as a web app</small></span></div>
          <div><b>&lt;/&gt;</b><span><strong>GitHub native</strong><small>Issues and pull requests</small></span></div>
        </div>
      </div>
    </section>
    <section class="library" style="padding-top:28px;padding-bottom:18px">
      <RouterLink to="/play/moonlit-parcel-dash" style="display:block;border:1px solid #2b2b2e;background:linear-gradient(135deg,#15152a,#0f1920);border-radius:18px;padding:18px 20px;display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap">
        <div><p class="eyebrow orange" style="margin:0">FEATURED PLAYABLE</p><h3 style="margin:6px 0 4px;font:700 22px Space Grotesk">🌙 Moonlit Parcel Dash — Play Now</h3><p style="margin:0;color:#9a9aa0;font-size:13px">Rover, parcels, rocks & beacon — 60s dash. Score, lives, win/lose & replay.</p></div>
        <span style="background:#ff6719;color:#0a0a0a;border-radius:999px;padding:10px 16px;font-weight:700;font-size:13px">Play ▶</span>
      </RouterLink>
    </section>
    <section id="discover" class="library">
      <div class="section-heading"><div><p class="eyebrow orange">BUILT IN PUBLIC</p><h2>{{ me ? `${me.login}'s games` : 'Games created with OmGithub' }}</h2></div></div>
      <div v-if="loadingProjects" class="cards-grid"><div v-for="n in 3" :key="n" class="game-card skeleton"></div></div>
      <div v-else-if="projects.length" class="cards-grid"><GameCard v-for="project in projects" :key="project.id || project.issue_path" :project="project" /></div>
      <div v-else class="empty-library">Your published games will appear here.</div>
    </section>
  </main>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import GameCard from '../components/GameCard.vue'
const props = defineProps({ me: Object })
const router = useRouter(), prompt = ref(''), loading = ref(false), error = ref(''), projects = ref([]), loadingProjects = ref(true)
async function loadProjects() {
  loadingProjects.value = true
  try {
    const r = await fetch(props.me ? '/api/projects?mine=1' : '/api/projects')
    projects.value = r.ok ? (await r.json()).projects : []
  } catch { projects.value = [] } finally { loadingProjects.value = false }
}
async function create() {
  if (!prompt.value.trim() || loading.value) return
  loading.value = true; error.value = ''
  try {
    const r = await fetch('/api/issues', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: prompt.value }) })
    const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Could not create issue')
    await router.push(data.omgithub_path)
  } catch (e) { error.value = e.message; loading.value = false }
}
onMounted(loadProjects); watch(() => props.me, loadProjects)
</script>
