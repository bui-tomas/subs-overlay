// Content script - runs on video pages

(function() {
  'use strict';

  let overlayWindow = null;
  let isEnabled = false;
  let currentVideo = null;
  let currentTrack = null;

  // Create the draggable overlay
  function createOverlay() {
    console.log('createOverlay called, overlayWindow exists?', !!overlayWindow);
    if (overlayWindow) return;

    overlayWindow = document.createElement('div');
    overlayWindow.id = 'subtitle-overlay-window';
    overlayWindow.innerHTML = `
      <div id="subtitle-overlay-content">
        <div id="current-subtitle">Test subtitle text</div>
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

  // Extract and sync subtitles with video
  function startSubtitleSync() {
    currentVideo = document.querySelector('video');
    
    if (!currentVideo) {
      console.log('No video element found');
      return;
    }

    // Try to find text track
    if (currentVideo.textTracks.length === 0) {
      console.log('No text tracks found');
      return;
    }

    currentTrack = currentVideo.textTracks[0];
    currentTrack.mode = 'hidden'; // Enable track but don't show native subs
    
    const subtitleDisplay = document.getElementById('current-subtitle');

    // Update subtitle based on video time
    function updateSubtitle() {
      if (!currentTrack || !currentTrack.cues) return;

      const currentTime = currentVideo.currentTime;
      let activeSubtitle = '';

      for (let i = 0; i < currentTrack.cues.length; i++) {
        const cue = currentTrack.cues[i];
        if (currentTime >= cue.startTime && currentTime <= cue.endTime) {
          activeSubtitle = cue.text;
          break;
        }
      }

      subtitleDisplay.textContent = activeSubtitle;
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
  function toggleOverlay() {
    console.log('Toggle called, isEnabled:', isEnabled);
    if (isEnabled) {
      console.log('Destroying overlay');
      destroyOverlay();
    } else {
      console.log('Creating overlay');
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
    }
  });

  console.log('Subtitle overlay extension loaded. Press Ctrl+Shift+S to toggle.');
})();