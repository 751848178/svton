<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  name: string;
  height?: string;
  title?: string;
}>();

const iframeRef = ref<HTMLIFrameElement | null>(null);
const autoHeight = ref<number | null>(null);
const demoTitle = computed(() => props.title || '可交互 Demo');
const src = computed(() => `/svton/demos/?demo=${props.name}`);

const demoHeight = computed(() => {
  if (autoHeight.value) return autoHeight.value + 'px';
  return props.height || '560px';
});

// Listen for height reports from iframe
function onMessage(e: MessageEvent) {
  if (e.data?.type === 'demo-height' && typeof e.data.height === 'number') {
    autoHeight.value = e.data.height;
  }
}

onMounted(() => window.addEventListener('message', onMessage));
onUnmounted(() => window.removeEventListener('message', onMessage));
</script>

<template>
  <div class="demo-container">
    <div class="demo-label">
      <span class="demo-badge">Demo</span>
      <span class="demo-title">{{ demoTitle }}</span>
    </div>
    <iframe
      ref="iframeRef"
      :src="src"
      :style="{ width: '100%', height: demoHeight, border: '1px solid #2a2a2a', borderRadius: '8px', background: '#0a0a0a', transition: 'height 0.2s' }"
      loading="lazy"
      frameborder="0"
      sandbox="allow-scripts allow-same-origin"
    />
  </div>
</template>

<style scoped>
.demo-container {
  margin: 16px 0;
  border-radius: 12px;
  overflow: hidden;
}
.demo-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
}
.demo-badge {
  background: #3B82F6;
  color: white;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}
.demo-title {
  font-size: 12px;
  color: #888;
}
iframe {
  border-radius: 0 0 8px 8px;
}
</style>
