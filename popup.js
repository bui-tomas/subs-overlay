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

// Handle subtitle file upload
document.getElementById('subtitleFile').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!data.subtitles || !Array.isArray(data.subtitles)) {
      alert('Invalid subtitle file format. Expected { "subtitles": [...] }');
      return;
    }

    // Save to chrome storage
    await chrome.storage.local.set({ subtitlesData: data });
    
    updateSubtitleCount(data.subtitles.length);
    
    // Notify content script if it's already running
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { 
      action: 'loadSubtitles',
      subtitlesData: data
    }, (response) => {
      if (response && response.success) {
        console.log('Subtitles loaded:', response.count);
      }
    });
    
  } catch (error) {
    console.error('Error loading subtitle file:', error);
    alert('Error loading subtitle file: ' + error.message);
  }
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

function updateSubtitleCount(count) {
  const countEl = document.getElementById('subtitleCount');
  countEl.textContent = count > 0 ? `${count} subtitles loaded` : 'No subtitles loaded';
}

// Check initial status when popup opens
window.addEventListener('load', async () => {
  // Check if subtitles are loaded
  const result = await chrome.storage.local.get(['subtitlesData']);
  if (result.subtitlesData && result.subtitlesData.subtitles) {
    updateSubtitleCount(result.subtitlesData.subtitles.length);
  }
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Try to get current status
  chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
    if (response && response.enabled) {
      updateStatus(true);
    }
  });
});