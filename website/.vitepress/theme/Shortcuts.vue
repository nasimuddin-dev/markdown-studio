<script setup lang="ts">
import { computed } from "vue";
import { data as shortcuts } from "../../../docs/site/data/shortcuts.data";

const props = defineProps<{ group: "app" | "format" }>();
const rows = computed(() => shortcuts.filter((s) => s.group === props.group));
</script>

<template>
  <table>
    <thead>
      <tr><th scope="col">Action</th><th scope="col">Windows / Linux</th><th scope="col">macOS</th></tr>
    </thead>
    <tbody>
      <tr v-for="s in rows" :key="s.id">
        <td>{{ s.label }}</td>
        <td><kbd>{{ s.windows }}</kbd></td>
        <td><kbd>{{ s.mac }}</kbd></td>
      </tr>
    </tbody>
  </table>
</template>
