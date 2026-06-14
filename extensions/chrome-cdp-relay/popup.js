// Popup script — shows connection status and attached tabs

function updateUI() {
  chrome.runtime.sendMessage({ type: 'get_status' }, (resp) => {
    if (!resp) return;
    const statusEl = document.getElementById('status');
    const tabsSection = document.getElementById('tabs-section');
    const tabsList = document.getElementById('tabs-list');

    if (resp.connected) {
      statusEl.className = 'status connected';
      statusEl.innerHTML = '<div class="dot green"></div><span class="status-text">已连接 Svton Agent</span>';
    } else {
      statusEl.className = 'status disconnected';
      statusEl.innerHTML = '<div class="dot red"></div><span class="status-text">未连接 Svton</span>';
    }

    if (resp.attachedTabs && resp.attachedTabs.length > 0) {
      tabsSection.style.display = 'block';
      tabsList.innerHTML = resp.attachedTabs.map(tabId => `
        <div class="tab-item attached">
          <div class="tab-favicon">🔗</div>
          <div class="tab-title">Tab #${tabId}</div>
          <div class="tab-badge">CDP</div>
        </div>
      `).join('');
    } else {
      tabsSection.style.display = 'none';
    }
  });
}

document.getElementById('reconnect').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'reconnect' }, () => {
    setTimeout(updateUI, 1000);
  });
});

updateUI();
setInterval(updateUI, 2000);
