<template>
  <main style="min-height:70vh;display:grid;place-items:center;padding:20px;background:radial-gradient(900px 600px at 50% -10%,#1a2a55 0%,#0d1020 45%,#07080c 100%)">
    <div style="width:min(440px,100%);text-align:center">
      <h1 style="font-size:14px;letter-spacing:.14em;opacity:.8;margin-bottom:10px">VOID DODGE — PLAY</h1>
      <div style="border:1px solid rgba(120,140,255,.22);border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.5);background:#07080c">
        <iframe
          src="/void-dodge.html"
          title="Void Dodge — dodge debris arcade game"
          aria-label="Void Dodge playable game"
          style="width:100%;height:640px;border:0;display:block;background:#070a16"
          loading="lazy"
          allow="autoplay"
          sandbox="allow-scripts allow-same-origin"
        ></iframe>
      </div>
      <p style="margin-top:10px;font-size:11px;opacity:.5;letter-spacing:.06em">
        Self-contained · <a href="/void-dodge.html" target="_blank" rel="noopener" style="color:#7aa0ff">Open standalone /void-dodge.html</a> · No external assets
      </p>
      <p style="margin-top:6px;font-size:11px;opacity:.45">Tip: use keyboard, drag, swipe, or on-screen ‹ › buttons. Press P to pause.</p>
    </div>
  </main>
</template>
<script setup>
// no logic — iframe hosts self-contained game at /void-dodge.html (site/public)
</script>
