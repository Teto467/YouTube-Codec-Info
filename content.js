// content.js (Release v3.5 - Realtime Settings Apply)
// console.log("YouTube Codec Info extension loaded. v3.5"); // Initial load message

let infoDisplay = null;
let lastVideoId = null;
let checkInterval = null;
let observer = null;
// Default settings including display toggles
let currentSettings = {
    isVisible: true,
    overlaySize: 13,
    showVideoCodec: true,
    showResolutionFps: true,
    showAudioCodec: true,
    showAudioDetails: true,
    showColorSpace: true,
    showStreamStatus: true,
};
let lastReceivedData = null; // Variable to store the latest codec data

// Inject script into page context
function injectScript(filePath) {
  const existingScript = document.getElementById('codec-info-injector-script');
  if (existingScript) return;
  const script = document.createElement('script');
  script.id = 'codec-info-injector-script';
  script.src = chrome.runtime.getURL(filePath);
  script.onload = function() { /* console.log(`[Content] ${filePath} injected and loaded.`); */ };
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
          // console.log("[Content] Moving overlay to current player container.");
          playerContainer.appendChild(infoDisplay);
      }
      // Ensure styles reflect current settings when getting existing overlay
      if (infoDisplay) {
           infoDisplay.style.fontSize = `${currentSettings.overlaySize}px`;
           const hasContent = infoDisplay.innerHTML.trim() !== '';
           infoDisplay.style.display = currentSettings.isVisible && hasContent ? 'block' : 'none';
           if (infoDisplay.style.display === 'block') {
                requestAnimationFrame(adjustOverlayPosition);
           }
      }
      return infoDisplay;
  }

  // Create new overlay if it doesn't exist
  const playerContainer = document.querySelector('#movie_player');
  if (!playerContainer) return null;

  infoDisplay = document.createElement('div');
  infoDisplay.id = 'youtube-codec-info-overlay';
  infoDisplay.style.display = currentSettings.isVisible ? 'block' : 'none'; // Initial display based on visibility
  infoDisplay.style.fontSize = `${currentSettings.overlaySize}px`;
  infoDisplay.innerHTML = ''; // Start empty
  playerContainer.appendChild(infoDisplay);
  // console.log("[Content] Codec info overlay created.");
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
  const overlay = getOrCreateOverlay(); // Ensure overlay exists or is created
  if (!player || !overlay) return; // Don't proceed if player or overlay isn't ready

  try {
      window.postMessage({ type: "GET_CODEC_INFO" }, "*");
  } catch (e) {
      console.error("[Content] Error posting message:", e);
      injectScript('inject.js');
  }

  // Video change check (only relevant for resetting content)
  const currentVideoId = getCurrentVideoId();
  if (currentVideoId && currentVideoId !== lastVideoId) {
    // console.log(`[Content] Video changed: ${lastVideoId} -> ${currentVideoId}`);
     lastVideoId = currentVideoId;
     lastReceivedData = null; // Reset stored data on video change
     if (overlay) {
        overlay.innerHTML = ''; // Clear content immediately
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

// Function to build overlay HTML from data and settings
function buildInfoHtml(data) {
    if (!data) return ''; // Return empty string if no data

    try {
        // --- Extract data ---
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
        const isLive = data.isLive || false;
        const isDash = data.isDash || false;
        const isMsl = data.isMsl || false;

        // --- Build display string based on currentSettings ---
        let infoParts = [];
        let statusParts = [];

        // Video Codec
        if (currentSettings.showVideoCodec && videoCodec !== 'N/A') {
            infoParts.push(`🎬 ${videoCodec}`);
        }
        // Resolution & FPS
        if (currentSettings.showResolutionFps && videoQuality) {
            const resFpsString = `${videoQuality}${videoFps}`;
            if (currentSettings.showVideoCodec && infoParts.length > 0 && videoCodec !== 'N/A') {
               infoParts[infoParts.length - 1] += ` (${resFpsString})`;
            } else {
                infoParts.push(`🖼️ ${resFpsString}`);
            }
        }
        // Audio Codec
        if (currentSettings.showAudioCodec && audioCodec !== 'N/A') {
             infoParts.push(`🔊 ${audioCodec}`);
        }
        // Audio Details
        if (currentSettings.showAudioDetails && (audioSampleRate || audioChannels)) {
            const audioDetails = [audioSampleRate, audioChannels].filter(Boolean).join(', ');
            if (audioDetails) {
                 if (currentSettings.showAudioCodec && infoParts.length > 0 && infoParts[infoParts.length-1].startsWith('🔊')) {
                    infoParts[infoParts.length - 1] += ` (${audioDetails})`;
                 } else {
                     infoParts.push(`👂 ${audioDetails}`);
                 }
            }
        }
        // Color Space
        if (currentSettings.showColorSpace && colorInfo) {
            infoParts.push(`🎨 ${colorInfo}`);
        }
        // Stream Status
        if (currentSettings.showStreamStatus) {
            if (isLive) statusParts.push(`🔴 LIVE`);
            if (isDash) statusParts.push(`DASH`);
            else if (isMsl) statusParts.push(`HLS`);
        }

        // Combine parts
        let infoText = infoParts.join(' | ');
        if (statusParts.length > 0) {
            infoText += (infoText ? '<br>' : '') + statusParts.join(' ');
        }

        return infoText.trim(); // Return the generated HTML string

    } catch (e) {
        console.error("[Content] Error building info HTML:", e, data);
        return "Codec Info Error"; // Return error string on failure
    }
}


// Listen for results from inject script
window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data || event.data.type !== "CODEC_INFO_RESULT") return;

  lastReceivedData = event.data.payload; // Store the received data
  const overlay = getOrCreateOverlay();
  if (!overlay) return;

  if (lastReceivedData) {
      const infoText = buildInfoHtml(lastReceivedData); // Use the build function

      // Update overlay display
      overlay.innerHTML = infoText; // Update content first
      const hasContent = infoText !== '';
      const shouldBeVisible = currentSettings.isVisible && hasContent;
      overlay.style.display = shouldBeVisible ? 'block' : 'none'; // Then update visibility

      if (shouldBeVisible) {
            requestAnimationFrame(adjustOverlayPosition); // Adjust position if visible
      }

  } else {
     // Handle case where payload is null (e.g., error from inject script)
     overlay.innerHTML = event.data.error ? `Error: ${event.data.error}` : '';
     overlay.style.display = 'none';
     lastReceivedData = null; // Reset stored data on error/null
  }
}, false);


// Apply settings from storage or popup (triggers immediate content refresh)
function applySettings(settings) {
  // Merge with defaults to ensure all keys exist
  currentSettings = { ...currentSettings, ...settings };
  // console.log("[Content] Applying settings:", currentSettings);
  const overlay = getOrCreateOverlay(); // Ensure overlay exists
  if (overlay) {
      overlay.style.fontSize = `${currentSettings.overlaySize}px`;

      // Regenerate HTML content using stored data and new settings
      const newHtml = buildInfoHtml(lastReceivedData);
      overlay.innerHTML = newHtml;

      // Update visibility based on settings and whether there's content
      const hasContent = newHtml !== '';
      const shouldBeVisible = currentSettings.isVisible && hasContent;
      overlay.style.display = shouldBeVisible ? 'block' : 'none';

      if (shouldBeVisible) {
          requestAnimationFrame(adjustOverlayPosition); // Adjust position if visible
      }
  }
}

// Load initial settings from storage
function loadInitialSettings() {
  chrome.storage.sync.get(currentSettings, (items) => {
    applySettings(items);
    // Request fresh data on initial load as lastReceivedData will be null
    if (getCurrentVideoId()) {
        // Delay slightly more on initial load to ensure player is ready
        setTimeout(updateCodecInfo, 600);
    }
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SETTINGS_UPDATED") {
        applySettings(request.payload);
        sendResponse({ status: "Settings applied" });
    }
    return true; // Indicate async response
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') { // Check if any relevant setting changed
      const changedKeys = Object.keys(changes);
      if (changedKeys.some(key => key in currentSettings)) {
            // console.log("[Content] Storage changed, reloading settings.");
            // Reload settings on external change, applySettings will handle refresh
            loadInitialSettings();
      }
  }
});

// Start/Stop periodic checks for info and position
 function startChecking() {
     if (checkInterval) return;
     // console.log("[Content] Starting periodic check...");

     const checkInjectLoaded = setInterval(() => {
         const injectorScript = document.getElementById('codec-info-injector-script');
         if (injectorScript && typeof window.postMessage === 'function') {
             clearInterval(checkInjectLoaded);
             // console.log("[Content] Inject script confirmed. Starting updates.");
             // Initial update request already handled in loadInitialSettings/handleNavigation
             /*setTimeout(() => {
                 if(getCurrentVideoId()) {
                     updateCodecInfo();
                     setTimeout(adjustOverlayPosition, 100);
                 }
             }, 500);*/

             checkInterval = setInterval(() => {
                 try {
                     if(getCurrentVideoId()) {
                         // Only request new data periodically, position adjusts automatically
                         updateCodecInfo();
                         // adjustOverlayPosition is called after data processing or setting change
                     }
                 } catch (error) {
                     console.error("[Content] Error inside setInterval callback:", error);
                 }
             }, 2000); // ★★★ Reduce frequency slightly (e.g., 2 seconds) as position updates are faster ★★★
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
         // console.log("[Content] Stopping periodic check.");
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
     // console.log("[Content] Starting MutationObserver for player and navigation.");
     observer.observe(targetNode, config);
     // Initial check might happen before player is fully ready, handleNavigation covers it
 }

// Handle navigation and player state changes
function handleNavigation() {
     const isOnWatchPage = getCurrentVideoId();
     const player = document.getElementById('movie_player');

     if (isOnWatchPage && player) {
         if (!checkInterval) {
             // console.log("[Content] Watch page and player detected. Initializing...");
             injectScript('inject.js');
             getOrCreateOverlay(); // Ensure overlay exists
             loadInitialSettings(); // Load settings and trigger initial update
             startChecking(); // Start periodic checks
         } else {
             // Check is already running, maybe page refreshed or navigated within watch page
             getOrCreateOverlay(); // Ensure overlay still exists
             requestAnimationFrame(adjustOverlayPosition); // Ensure position is correct
             // Check if video ID changed, updateCodecInfo handles this
             updateCodecInfo();
         }
     } else {
         // Not on watch page or player removed
         if (checkInterval) {
             stopChecking();
         }
         const overlay = document.getElementById('youtube-codec-info-overlay');
         if (overlay) overlay.style.display = 'none'; // Hide overlay
         lastVideoId = null; // Reset video ID
         lastReceivedData = null; // Reset data
     }
 }

 // --- Initialization ---
 loadInitialSettings(); // Load settings first
 // Start observing after DOM is ready
 if (document.readyState === 'loading') {
     document.addEventListener('DOMContentLoaded', observePlayerAndNavigation);
 } else {
     observePlayerAndNavigation();
 }
 window.addEventListener('beforeunload', () => {
     stopChecking();
     if(observer) observer.disconnect();
 });

// console.log("YouTube Codec Info content script initialized. v3.5");