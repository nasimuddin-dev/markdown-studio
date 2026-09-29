<script setup lang="ts">
import { computed } from "vue";
import { withBase } from "vitepress";
import { data as release } from "../../../docs/site/data/release.data";

/** Which platforms to show; all by default. */
const props = defineProps<{ only?: "windows" | "macos" | "linux" }>();
const platforms = computed(() =>
  [
    { id: "windows", name: "Windows", req: "Windows 10 (1803 or later) or Windows 11, 64-bit", items: release.windows, guide: "/installation/windows" },
    { id: "macos", name: "macOS", req: "macOS 10.15 or later, Apple Silicon or Intel", items: release.macos, guide: "/installation/macos" },
    { id: "linux", name: "Linux", req: "64-bit (x86_64) distributions from 2022 or later", items: release.linux, guide: "/installation/linux" },
  ].filter((p) => !props.only || p.id === props.only),
);
</script>

<template>
  <div class="ms-downloads">
    <section v-for="p in platforms" :key="p.id" class="ms-platform" :aria-labelledby="`dl-${p.id}`">
      <h3 :id="`dl-${p.id}`">{{ p.name }}</h3>
      <p class="ms-req">{{ p.req }}</p>
      <ul>
        <li v-for="i in p.items" :key="i.file">
          <a :href="i.url" class="ms-dl">
            <span class="ms-dl-label">{{ i.label }}</span>
            <span class="ms-dl-file">{{ i.file }}</span>
          </a>
          <span class="ms-dl-note">{{ i.note }}</span>
        </li>
      </ul>
      <p class="ms-guide"><a :href="withBase(p.guide)">{{ p.name }} installation guide →</a></p>
    </section>
  </div>
</template>

<style scoped>
.ms-downloads { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); margin: 16px 0; }
.ms-platform { border: 1px solid var(--vp-c-divider); border-radius: 12px; padding: 16px 18px; background: var(--vp-c-bg-soft); }
.ms-platform h3 { margin: 0 0 4px; padding: 0; border: 0; }
.ms-req { margin: 0 0 12px; font-size: 14px; color: var(--vp-c-text-2); }
.ms-platform ul { list-style: none; padding: 0; margin: 0; }
.ms-platform li { margin: 0 0 12px; }
.ms-dl { display: block; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--vp-c-brand-2); text-decoration: none !important; }
.ms-dl:hover, .ms-dl:focus-visible { background: var(--vp-c-brand-soft); }
.ms-dl-label { display: block; font-weight: 600; }
.ms-dl-file { display: block; font-family: var(--vp-font-family-mono); font-size: 12px; color: var(--vp-c-text-2); overflow-wrap: anywhere; }
.ms-dl-note { display: block; font-size: 13px; color: var(--vp-c-text-2); margin-top: 4px; }
.ms-guide { margin: 4px 0 0; font-size: 14px; }
</style>
