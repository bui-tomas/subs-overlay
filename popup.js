// Popup script

document.getElementById('toggleBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { action: 'toggleOverlay' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error:', chrome.runtime.lastError);
      updateStatus(false);
      return;
    }
    
    if (response) {
      updateStatus(response.enabled);
    }
  });
});

function updateStatus(enabled) {
  const statusEl = document.getElementById('status');
  
  if (enabled) {
    statusEl.textContent = 'Overlay: Enabled';
    statusEl.className = 'status enabled';
  } else {
    statusEl.textContent = 'Overlay: Disabled';
    statusEl.className = 'status disabled';
  }
}

// Check initial status when popup opens
window.addEventListener('load', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Try to get current status
  chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
    if (response && response.enabled) {
      updateStatus(true);
    }
  });
});