// Svton CDP Relay — Background Service Worker
// Connects to Svton desktop app via WebSocket and relays CDP commands via chrome.debugger API.

const SVTON_WS_URL = 'ws://localhost:9223';
let ws = null;
let connected = false;
let attachedTabs = new Map(); // tabId -> targetId

// ── WebSocket connection to Svton ──────────────────────

function connectToSvton() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

  console.log('[Svton CDP] Connecting to', SVTON_WS_URL);
  ws = new WebSocket(SVTON_WS_URL);

  ws.onopen = () => {
    connected = true;
    console.log('[Svton CDP] Connected to Svton');
    broadcastStatus();
    // Send hello with available tabs
    refreshTabList();
  };

  ws.onclose = () => {
    connected = false;
    console.log('[Svton CDP] Disconnected from Svton');
    broadcastStatus();
    // Detach all tabs
    for (const tabId of attachedTabs.keys()) {
      chrome.debugger.detach({ tabId }).catch(() => {});
    }
    attachedTabs.clear();
    // Reconnect after 3s
    setTimeout(connectToSvton, 3000);
  };

  ws.onerror = (err) => {
    console.error('[Svton CDP] WebSocket error', err);
  };

  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      await handleMessage(msg);
    } catch (e) {
      console.error('[Svton CDP] Message handler error', e);
      sendToSvton({ type: 'error', error: e.message, id: msg?.id });
    }
  };
}

// ── Message handling ────────────────────────────────────

async function handleMessage(msg) {
  const { type, id } = msg;

  switch (type) {
    case 'list_tabs': {
      const tabs = await chrome.tabs.query({});
      const targets = tabs
        .filter(t => t.url && !t.url.startsWith('chrome://'))
        .map(t => ({
          targetId: String(t.id),
          type: 'page',
          title: t.title,
          url: t.url,
          tabId: t.id,
        }));
      sendToSvton({ type: 'response', id, result: { targets } });
      break;
    }

    case 'attach': {
      const { tabId } = msg;
      try {
        await chrome.debugger.attach({ tabId }, '1.3');
        attachedTabs.set(tabId, String(tabId));
        console.log('[Svton CDP] Attached to tab', tabId);
        sendToSvton({ type: 'response', id, result: { attached: true, tabId } });
      } catch (e) {
        sendToSvton({ type: 'response', id, error: e.message });
      }
      break;
    }

    case 'detach': {
      const { tabId } = msg;
      try {
        await chrome.debugger.detach({ tabId });
        attachedTabs.delete(tabId);
        sendToSvton({ type: 'response', id, result: { detached: true } });
      } catch (e) {
        sendToSvton({ type: 'response', id, error: e.message });
      }
      break;
    }

    case 'cdp_command': {
      const { tabId, method, params } = msg;
      try {
        const result = await chrome.debugger.sendCommand({ tabId }, method, params || {});
        sendToSvton({ type: 'response', id, result });
      } catch (e) {
        sendToSvton({ type: 'response', id, error: e.message });
      }
      break;
    }

    case 'screenshot': {
      const { tabId } = msg;
      try {
        const result = await chrome.debugger.sendCommand({ tabId }, 'Page.captureScreenshot', {
          format: 'jpeg',
          quality: 80,
        });
        sendToSvton({ type: 'response', id, result });
      } catch (e) {
        sendToSvton({ type: 'response', id, error: e.message });
      }
      break;
    }

    case 'navigate': {
      const { tabId, url } = msg;
      try {
        await chrome.debugger.sendCommand({ tabId }, 'Page.navigate', { url });
        // Wait a bit for load
        await new Promise(r => setTimeout(r, 1000));
        sendToSvton({ type: 'response', id, result: { navigated: true } });
      } catch (e) {
        sendToSvton({ type: 'response', id, error: e.message });
      }
      break;
    }

    case 'ping': {
      sendToSvton({ type: 'response', id, result: { pong: true } });
      break;
    }

    default:
      sendToSvton({ type: 'response', id, error: `Unknown message type: ${type}` });
  }
}

// ── CDP event relay ──────────────────────────────────────

chrome.debugger.onEvent.addListener((source, method, params) => {
  sendToSvton({
    type: 'cdp_event',
    tabId: source.tabId,
    method,
    params,
  });
});

chrome.debugger.onDetach.addListener((source, reason) => {
  attachedTabs.delete(source.tabId);
  sendToSvton({
    type: 'detached',
    tabId: source.tabId,
    reason,
  });
});

// ── Helpers ──────────────────────────────────────────────

function sendToSvton(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

async function refreshTabList() {
  if (!connected) return;
  const tabs = await chrome.tabs.query({});
  const targets = tabs
    .filter(t => t.url && !t.url.startsWith('chrome://'))
    .map(t => ({
      targetId: String(t.id),
      type: 'page',
      title: t.title,
      url: t.url,
    }));
  sendToSvton({ type: 'tab_list_updated', targets });
}

function broadcastStatus() {
  chrome.action.setIcon({
    path: connected ? 'icons/icon48-active.png' : 'icons/icon48.png',
  }).catch(() => {});
}

// ── Lifecycle ────────────────────────────────────────────

// Auto-connect on startup
connectToSvton();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'get_status') {
    sendResponse({ connected, attachedTabs: [...attachedTabs.keys()] });
    return true;
  }
  if (msg.type === 'reconnect') {
    connectToSvton();
    sendResponse({ ok: true });
    return true;
  }
});
