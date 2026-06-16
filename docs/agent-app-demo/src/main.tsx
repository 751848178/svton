/**
 * Demo entry — bundled at build time, loads via importmap for react.
 */
import 'reflect-metadata';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AgentApp } from '../../../packages/agent-app/src';

interface DemoConfig {
  type: 'openai' | 'anthropic';
  apiKey: string;
  baseUrl?: string;
  models: Array<{ id: string; name: string }>;
}

function getConfig(): DemoConfig | null {
  try {
    const raw = localStorage.getItem('svton-demo:config');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function init() {
  const container = document.getElementById('app')!;
  const config = getConfig();

  if (!config || !config.apiKey) {
    document.getElementById('gate')!.classList.remove('hidden');
    container.innerHTML = '';
    return;
  }

  document.getElementById('gate')!.classList.add('hidden');
  container.innerHTML = '<div class="loading">正在初始化 Agent...</div>';

  const root = createRoot(container);
  root.render(
    React.createElement(AgentApp, {
      providers: [{
        type: config.type,
        apiKey: config.apiKey,
        ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
        models: config.models,
      }],
      defaultModel: config.models[0]?.id,
      title: 'Svton Agent Demo',
      features: { imageGeneration: true, codeReview: true, documentPreview: true, webSearch: false },
    })
  );
}

function setupGate() {
  const MODELS: Record<string, Array<{ id: string; name: string }>> = {
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    ],
    anthropic: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-haiku-4-20250506', name: 'Claude Haiku 4' },
    ],
  };

  const providerSelect = document.getElementById('providerType') as HTMLSelectElement;
  const modelTagsEl = document.getElementById('modelTags')!;
  const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
  const baseUrlInput = document.getElementById('baseUrl') as HTMLInputElement;
  const startBtn = document.getElementById('startBtn')!;
  const customToggle = document.getElementById('customModelToggle') as HTMLInputElement;
  const customModelRow = document.getElementById('customModelRow')!;
  const customModelId = document.getElementById('customModelId') as HTMLInputElement;
  const customModelName = document.getElementById('customModelName') as HTMLInputElement;
  const presetLabel = document.getElementById('presetLabel')!;

  let selectedModels = new Set<string>(['gpt-4o']);
  let useCustom = false;

  function updateModels() {
    const type = providerSelect.value;
    const models = MODELS[type] || [];
    selectedModels = new Set([models[0]?.id]);
    modelTagsEl.innerHTML = models.map(m =>
      `<span class="gate-model-tag ${selectedModels.has(m.id) ? 'selected' : ''}" data-id="${m.id}">${m.name}</span>`
    ).join('');
    baseUrlInput.placeholder = type === 'openai' ? 'https://api.openai.com' : 'https://api.anthropic.com';
    // Update custom model placeholder based on provider
    customModelId.placeholder = type === 'openai'
      ? '例如: gpt-4-turbo, o1, text-embedding-3-small'
      : '例如: claude-3-opus-20240229';
  }

  modelTagsEl.addEventListener('click', (e) => {
    const tag = (e.target as HTMLElement).closest('.gate-model-tag');
    if (!tag) return;
    const id = tag.dataset.id!;
    if (selectedModels.has(id)) { if (selectedModels.size > 1) selectedModels.delete(id); }
    else { selectedModels.add(id); }
    modelTagsEl.querySelectorAll('.gate-model-tag').forEach((t: Element) =>
      t.classList.toggle('selected', selectedModels.has(t.getAttribute('data-id')!))
    );
  });

  customToggle.addEventListener('change', () => {
    useCustom = customToggle.checked;
    customModelRow.style.display = useCustom ? 'block' : 'none';
    modelTagsEl.style.opacity = useCustom ? '0.4' : '1';
    modelTagsEl.style.pointerEvents = useCustom ? 'none' : 'auto';
    (presetLabel as HTMLElement).style.opacity = useCustom ? '0.4' : '1';
  });

  providerSelect.addEventListener('change', updateModels);

  startBtn.addEventListener('click', () => {
    const type = providerSelect.value as 'openai' | 'anthropic';
    const apiKey = apiKeyInput.value.trim();
    const baseUrl = baseUrlInput.value.trim();
    if (!apiKey) { alert('请输入 API Key'); return; }

    let models: Array<{ id: string; name: string }>;
    if (useCustom) {
      const id = customModelId.value.trim();
      const name = customModelName.value.trim() || id;
      if (!id) { alert('请输入自定义模型 ID'); return; }
      models = [{ id, name }];
    } else {
      models = (MODELS[type] || []).filter(m => selectedModels.has(m.id));
      if (!models.length) { alert('请至少选择一个模型'); return; }
    }

    localStorage.setItem('svton-demo:config', JSON.stringify({ type, apiKey, baseUrl, models }));
    init();
  });

  apiKeyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') startBtn.click(); });

  const saved = getConfig();
  if (saved?.apiKey) {
    providerSelect.value = saved.type;
    apiKeyInput.value = saved.apiKey;
    if (saved.baseUrl) baseUrlInput.value = saved.baseUrl;
  }

  updateModels();
}

setupGate();
init();
