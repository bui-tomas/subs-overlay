// Content script - runs on video pages

(function() {
  'use strict';

  let overlayWindow = null;
  let isEnabled = false;
  let currentVideo = null;
  let subtitles = []; // Will hold loaded subtitles from JSON
  const TIMESTAMP_OFFSET = 18.8; // Offset to subtract from all timestamps (hardcoded for now)

  // Create the draggable overlay
  function createOverlay() {
    console.log('createOverlay called, overlayWindow exists?', !!overlayWindow);
    if (overlayWindow) return;

    overlayWindow = document.createElement('div');
    overlayWindow.id = 'subtitle-overlay-window';
    overlayWindow.innerHTML = `
      <div id="subtitle-overlay-content">
        <div id="subtitle-hanzi"></div>
        <div id="subtitle-pinyin"></div>
        <div id="subtitle-english"></div>
      </div>
    `;
    
    console.log('Created overlay element:', overlayWindow);
    console.log('Appending to body...');
    document.body.appendChild(overlayWindow);
    console.log('Overlay appended, visible in DOM?', document.getElementById('subtitle-overlay-window'));
    
    // Load saved position
    chrome.storage.local.get(['overlayPosition'], (result) => {
      if (result.overlayPosition) {
        overlayWindow.style.left = result.overlayPosition.x + 'px';
        overlayWindow.style.top = result.overlayPosition.y + 'px';
        console.log('Loaded saved position:', result.overlayPosition);
      }
    });

    makeDraggable(overlayWindow);
    console.log('Draggable setup complete');
  }

  // Make the overlay draggable
  function makeDraggable(element) {
    const content = element.querySelector('#subtitle-overlay-content');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    content.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
      initialX = e.clientX - element.offsetLeft;
      initialY = e.clientY - element.offsetTop;
      isDragging = true;
      content.style.cursor = 'grabbing';
    }

    function drag(e) {
      if (!isDragging) return;
      
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      element.style.left = currentX + 'px';
      element.style.top = currentY + 'px';
    }

    function dragEnd(e) {
      if (!isDragging) return;
      
      isDragging = false;
      content.style.cursor = 'grab';
      
      // Save position
      chrome.storage.local.set({
        overlayPosition: {
          x: currentX,
          y: currentY
        }
      });
    }
  }

  // Load subtitles from JSON file
  async function loadSubtitles() {
    try {
      // Try to load from chrome storage first (can be set by user uploading JSON)
      const result = await chrome.storage.local.get(['subtitlesData']);
      if (result.subtitlesData) {
        subtitles = result.subtitlesData.subtitles || [];
        console.log('Loaded subtitles from storage:', subtitles.length);
        return;
      }
      
      // If no stored data, subtitles array stays empty
      console.log('No subtitles loaded');
    } catch (error) {
      console.error('Error loading subtitles:', error);
    }
  }

  // Extract and sync subtitles with video
  function startSubtitleSync() {
    currentVideo = document.querySelector('video');
    
    if (!currentVideo) {
      console.log('No video element found');
      return;
    }

    const hanziDisplay = document.getElementById('subtitle-hanzi');
    const pinyinDisplay = document.getElementById('subtitle-pinyin');
    const englishDisplay = document.getElementById('subtitle-english');

    // Update subtitle based on video time
    function updateSubtitle() {
      if (subtitles.length === 0) {
        // Fallback to trying text tracks if no JSON subtitles loaded
        tryTextTracks();
        return;
      }

      // Apply offset to video time
      const currentTime = currentVideo.currentTime + TIMESTAMP_OFFSET;
      
      // Clear current subtitles
      let activeSubtitle = null;

      // Find the subtitle for current time
      for (let i = 0; i < subtitles.length; i++) {
        const sub = subtitles[i];
        if (currentTime >= sub.start && currentTime <= sub.end) {
          activeSubtitle = sub;
          break;
        }
      }

      if (activeSubtitle) {
        hanziDisplay.textContent = activeSubtitle.hanzi || '';
        pinyinDisplay.textContent = activeSubtitle.pinyin || '';
        englishDisplay.textContent = activeSubtitle.english || '';
      } else {
        hanziDisplay.textContent = '';
        pinyinDisplay.textContent = '';
        englishDisplay.textContent = '';
      }
    }

    // Fallback to text tracks if JSON not available
    function tryTextTracks() {
      if (currentVideo.textTracks.length === 0) {
        console.log('No text tracks found');
        return;
      }

      const track = currentVideo.textTracks[0];
      track.mode = 'hidden';
      
      const englishDisplay = document.getElementById('subtitle-english');
      
      const currentTime = currentVideo.currentTime;
      let activeText = '';

      if (track.cues) {
        for (let i = 0; i < track.cues.length; i++) {
          const cue = track.cues[i];
          if (currentTime >= cue.startTime && currentTime <= cue.endTime) {
            activeText = cue.text;
            break;
          }
        }
      }

      englishDisplay.textContent = activeText;
    }

    // Update on timeupdate
    currentVideo.addEventListener('timeupdate', updateSubtitle);

    // Initial update
    updateSubtitle();
  }

  // Destroy the overlay
  function destroyOverlay() {
    if (overlayWindow) {
      overlayWindow.remove();
      overlayWindow = null;
    }
    isEnabled = false;
  }

  // Toggle overlay on/off
  async function toggleOverlay() {
    console.log('Toggle called, isEnabled:', isEnabled);
    if (isEnabled) {
      console.log('Destroying overlay');
      destroyOverlay();
    } else {
      console.log('Creating overlay');
      await loadSubtitles(); // Load subtitles before creating overlay
      createOverlay();
      console.log('Overlay element:', overlayWindow);
      console.log('Starting subtitle sync');
      startSubtitleSync();
      isEnabled = true;
    }
  }

  // Listen for keyboard shortcut (Cmd+Shift+S on Mac, Ctrl+Shift+S on Windows/Linux)
  document.addEventListener('keydown', (e) => {
    console.log('Key pressed:', e.key, 'Ctrl:', e.ctrlKey, 'Cmd:', e.metaKey, 'Shift:', e.shiftKey);
    
    const modifierKey = e.ctrlKey || e.metaKey; // Ctrl on Windows/Linux, Cmd on Mac
    
    if (modifierKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      console.log('Shortcut matched!');
      e.preventDefault();
      toggleOverlay();
    }
  });

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleOverlay') {
      toggleOverlay();
      sendResponse({ enabled: isEnabled });
    } else if (request.action === 'loadSubtitles') {
      // Allow loading subtitles from popup
      if (request.subtitlesData) {
        chrome.storage.local.set({ subtitlesData: request.subtitlesData }, () => {
          console.log('Subtitles saved to storage');
          loadSubtitles().then(() => {
            sendResponse({ success: true, count: subtitles.length });
          });
        });
        return true; // Keep message channel open for async response
      }
    }
  });

  console.log('Subtitle overlay extension loaded. Press Ctrl+Shift+S to toggle.');
})();