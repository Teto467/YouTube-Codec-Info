// content.js (Release v3.3 - Robust Dynamic Position)
console.log("YouTube Codec Info extension loaded. v3.3"); // Initial load message

let infoDisplay = null;
let lastVideoId = null;
let checkInterval = null;
let observer = null;
let currentSettings = { isVisible: true, overlaySize: 13 };

// Inject script into page context
function injectScript(filePath) {
  const existingScript = document.getElementById('codec-info-injector-script');
  if (existingScript) return;
  const script = document.createElement('script');
  script.id = 'codec-info-injector-script';
  script.src = chrome.runtime.getURL(filePath);
  script.onload = function() { /* console.log(`[Content] ${filePath} injected and loaded.`); */ }; // Log commented out
  script.onerror = function() { console.error(`[Content] Failed to load ${filePath}`); };
  (document.head || document.documentElement).appendChild(script);
}

// Get or create the overlay element
function getOrCreateOverlay() {
  const existingOverlay = document.getElementById('youtube-codec-info-overlay');
  if (existingOverlay) {
      infoDisplay = existingOverlay;
      const playerContainer = document.querySelector('#movie_player');
      if (playerContainer && !playerContainer.contains(infoDisplay)) {
          // console.log("[Content] Moving overlay to current player container."); // Log commented out
          playerContainer.appendChild(infoDisplay);
      }
      applySettings(currentSettings); // Ensure settings are applied
      return infoDisplay;
  }
  const playerContainer = document.querySelector('#movie_player');
  if (!playerContainer) return null;

  infoDisplay = document.createElement('div');
  infoDisplay.id = 'youtube-codec-info-overlay';
  infoDisplay.style.display = currentSettings.isVisible ? 'block' : 'none';
  infoDisplay.style.fontSize = `${currentSettings.overlaySize}px`;
  infoDisplay.innerHTML = '';
  playerContainer.appendChild(infoDisplay);
  // console.log("[Content] Codec info overlay created."); // Log commented out
  return infoDisplay;
}

// Adjust overlay position based on controls visibility
function adjustOverlayPosition() {
    const overlay = document.getElementById('youtube-codec-info-overlay');
    if (!overlay || overlay.style.display === 'none') return;

    const player = document.getElementById('movie_player');
    if (!player) return;

    const controls = player.querySelector('.ytp-chrome-bottom');
    const progressBarContainer = player.querySelector('.ytp-progress-bar-container');

    const defaultBottom = '10px';
    const marginAboveControls = 5;

    let targetBottom = defaultBottom; // Default to bottom left

    // Only adjust if controls are found
    if (controls && progressBarContainer) {
        let isControlsVisible = false;
        let controlsHeight = 0;

        try {
            const controlsStyle = window.getComputedStyle(controls);
            const controlsOpacity = parseFloat(controlsStyle.opacity);
            const controlsOffsetHeight = controls.offsetHeight;

            isControlsVisible = controlsOpacity > 0.1 && controlsOffsetHeight > 10;

            if (isControlsVisible) {
                controlsHeight = controlsOffsetHeight;
                targetBottom = `${controlsHeight + marginAboveControls}px`; // Position above controls
            }
        } catch (e) {
            console.error("[AdjustPos] Error accessing control styles/height:", e);
            // Revert to default on error
            targetBottom = defaultBottom;
        }
    } else {
        // If controls are not found, ensure it's at the default bottom
        targetBottom = defaultBottom;
    }

    // Update style only if needed
    if (overlay.style.bottom !== targetBottom) {
        overlay.style.bottom = targetBottom;
    }
}

// Request codec info from inject script
function updateCodecInfo() {
  const player = document.getElementById('movie_player');
  const overlay = getOrCreateOverlay();
  if (!player || !overlay) return;

  try {
      window.postMessage({ type: "GET_CODEC_INFO" }, "*");
  } catch (e) {
      console.error("[Content] Error posting message:", e);
      injectScript('inject.js');
  }

  const currentVideoId = getCurrentVideoId();
  if (currentVideoId && currentVideoId !== lastVideoId) {
    // console.log(`[Content] Video changed: ${lastVideoId} -> ${currentVideoId}`); // Log commented out
     lastVideoId = currentVideoId;
     if (overlay) {
        overlay.innerHTML = '';
        overlay.style.display = 'none';
     }
  }
}

// Get current video ID from URL
function getCurrentVideoId() {
  if (window.location.pathname === '/watch') {
    const params = new URLSearchParams(window.location.search);
    return params.get('v');
  }
  return null;
}

// Listen for results from inject script
window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data || event.data.type !== "CODEC_INFO_RESULT") return;

  const data = event.data.payload;
  const overlay = getOrCreateOverlay();
  if (!overlay) return;

  if (data) {
    try {
        const videoQuality = data.qualityLabel || data.resolution || (data.height ? `${data.height}p` : '');
        const videoFps = data.fps ? `@${data.fps}` : '';
        const videoCodec = data.videoCodec?.split('.')[0] || 'N/A';
        const audioCodec = data.audioCodec?.split('.')[0] || 'N/A';
        const colorPrimaries = data.colorInfo?.primaries?.replace('COLOR_PRIMARIES_', '') || '';
        const colorTransfer = data.colorInfo?.transferCharacteristics?.replace('COLOR_TRANSFER_', '') || '';
        const colorMatrix = data.colorInfo?.matrixCoefficients?.replace('COLOR_MATRIX_', '') || '';
        const colorInfo = [colorPrimaries, colorTransfer, colorMatrix].filter(Boolean).map(s => s.toUpperCase()).join(' / ');
        const audioSampleRate = data.audioSampleRate ? `${Math.round(parseInt(data.audioSampleRate) / 1000)}kHz` : '';
        const audioChannels = data.audioChannels ? `${data.audioChannels}ch` : '';
        let infoParts = [];
        if (videoCodec !== 'N/A') { let videoStr = `🎬 ${videoCodec}`; if (videoQuality) videoStr += ` (${videoQuality}${videoFps})`; infoParts.push(videoStr); }
        if (audioCodec !== 'N/A') { let audioStr = `🔊 ${audioCodec}`; let audioDetails = [audioSampleRate, audioChannels].filter(Boolean).join(', '); if (audioDetails) audioStr += ` (${audioDetails})`; infoParts.push(audioStr); }
        if (colorInfo) infoParts.push(`🎨 ${colorInfo}`);
        let statusFlags = [];
        if(data.isLive) statusFlags.push(`🔴 LIVE`);
        if(data.isDash) statusFlags.push(`DASH`);
        else if (data.isMsl) statusFlags.push(`HLS`);
        let infoText = infoParts.join(' | ');
        if (statusFlags.length > 0) { infoText += `<br>${statusFlags.join(' ')}`; }

        if (infoText.trim() === '' || (videoCodec === 'N/A' && audioCodec === 'N/A')) {
             overlay.innerHTML = '';
             if (currentSettings.isVisible) overlay.style.display = 'none';
        } else {
             overlay.innerHTML = infoText;
             overlay.style.display = currentSettings.isVisible ? 'block' : 'none';
             if (currentSettings.isVisible) {
                 requestAnimationFrame(adjustOverlayPosition);
             }
        }
    } catch (e) {
        console.error("[Content] Error parsing codec info:", e, data);
        if (overlay) {
           overlay.innerHTML = "Codec Info Error";
           overlay.style.display = currentSettings.isVisible ? 'block' : 'none';
            if (currentSettings.isVisible) {
                 requestAnimationFrame(adjustOverlayPosition);
             }
        }
    }
  } else {
     if (overlay) overlay.style.display = 'none';
  }
}, false);

// Apply settings from storage or popup
function applySettings(settings) {
  currentSettings = settings;
  const overlay = document.getElementById('youtube-codec-info-overlay');
  if (overlay) {
      const hasContent = overlay.innerHTML.trim() !== '';
      const shouldBeVisible = settings.isVisible && hasContent;
      overlay.style.display = shouldBeVisible ? 'block' : 'none';
      overlay.style.fontSize = `${settings.overlaySize}px`;
      if (shouldBeVisible) {
          requestAnimationFrame(adjustOverlayPosition);
      }
  }
}

// Load initial settings from storage
function loadInitialSettings() {
  chrome.storage.sync.get({ isVisible: true, overlaySize: 13 }, (items) => {
    applySettings(items);
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SETTINGS_UPDATED") {
        applySettings(request.payload);
        sendResponse({ status: "Settings applied" });
    }
    return true;
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && (changes.isVisible || changes.overlaySize)) {
    loadInitialSettings();
  }
});

// Start/Stop periodic checks for info and position
 function startChecking() {
     if (checkInterval) return;
     // console.log("[Content] Starting periodic check..."); // Log commented out

     const checkInjectLoaded = setInterval(() => {
         const injectorScript = document.getElementById('codec-info-injector-script');
         if (injectorScript && typeof window.postMessage === 'function') {
             clearInterval(checkInjectLoaded);
             // console.log("[Content] Inject script confirmed. Starting updates."); // Log commented out
             setTimeout(() => {
                 if(getCurrentVideoId()) {
                     updateCodecInfo();
                     setTimeout(adjustOverlayPosition, 100);
                 }
             }, 500);

             checkInterval = setInterval(() => {
                 try {
                     if(getCurrentVideoId()) {
                         updateCodecInfo();
                         adjustOverlayPosition();
                     }
                 } catch (error) {
                     console.error("[Content] Error inside setInterval callback:", error);
                 }
             }, 200); // Check every 200ms
         } else {
              if (!injectorScript) injectScript('inject.js');
         }
     }, 500);

     setTimeout(() => {
        if (!checkInterval) {
            clearInterval(checkInjectLoaded);
            console.error("[Content] Inject script did not load or postMessage not ready within timeout.");
        }
     }, 10000);
 }

 function stopChecking() {
     if (checkInterval) {
         // console.log("[Content] Stopping periodic check."); // Log commented out
         clearInterval(checkInterval);
         checkInterval = null;
     }
 }

// Observe player and navigation changes (SPA support)
function observePlayerAndNavigation() {
     if (observer) observer.disconnect();

     const targetNode = document.body;
     const config = { childList: true, subtree: true };
     let currentHref = document.location.href;
     let navigationDebounceTimer = null;
     let playerCheckDebounceTimer = null;

     observer = new MutationObserver((mutationsList, observer) => {
         clearTimeout(navigationDebounceTimer);
         navigationDebounceTimer = setTimeout(() => {
             if (document.location.href !== currentHref) {
                 currentHref = document.location.href;
                 handleNavigation();
             }
         }, 100);

         let playerFound = false;
         let playerRemoved = false;
         for(const mutation of mutationsList) {
              if (mutation.type === 'childList') {
                 mutation.addedNodes.forEach(node => { if (node.nodeType === 1 && (node.id === 'movie_player' || (node.querySelector && node.querySelector('#movie_player')))) playerFound = true; });
                 mutation.removedNodes.forEach(node => { if (node.nodeType === 1 && node.id === 'movie_player') playerRemoved = true; });
             }
             if (playerFound || playerRemoved) break;
         }
         if (playerFound || playerRemoved) {
            clearTimeout(playerCheckDebounceTimer);
            playerCheckDebounceTimer = setTimeout(() => { handleNavigation(); }, 200);
         }
     });
     // console.log("[Content] Starting MutationObserver for player and navigation."); // Log commented out
     observer.observe(targetNode, config);
     handleNavigation(); // Initial check
 }

// Handle navigation and player state changes
function handleNavigation() {
     const isOnWatchPage = getCurrentVideoId();
     const player = document.getElementById('movie_player');

     if (isOnWatchPage && player) {
         if (!checkInterval) {
             // console.log("[Content] Watch page and player detected. Initializing..."); // Log commented out
             injectScript('inject.js');
             getOrCreateOverlay();
             loadInitialSettings();
             startChecking();
         } else {
             // Ensure overlay exists and position is checked on navigation/refresh
             getOrCreateOverlay();
             requestAnimationFrame(adjustOverlayPosition);
             updateCodecInfo(); // Check if video ID changed
         }
     } else {
         if (checkInterval) {
             stopChecking();
         }
         const overlay = document.getElementById('youtube-codec-info-overlay');
         if (overlay) overlay.style.display = 'none';
         lastVideoId = null;
     }
 }

 // --- Initialization ---
 loadInitialSettings();
 if (document.readyState === 'loading') {
     document.addEventListener('DOMContentLoaded', observePlayerAndNavigation);
 } else {
     observePlayerAndNavigation();
 }
 window.addEventListener('beforeunload', () => {
     stopChecking();
     if(observer) observer.disconnect();
 });

// console.log("YouTube Codec Info content script initialized. v3.3"); // Can be removed for final release