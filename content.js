// content.js (Release v3.5 - Realtime Settings Apply - EOTF Debug)
console.log("YouTube Codec Info extension loaded. v3.5 Debug"); // Version updated

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

// --- injectScript, getOrCreateOverlay (変更なし) ---
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
            playerContainer.appendChild(infoDisplay);
        }
        // ★★★ Apply styles directly when retrieving existing overlay ★★★
        if (infoDisplay) {
             infoDisplay.style.fontSize = `${currentSettings.overlaySize}px`; // Apply font size
             const hasContent = infoDisplay.innerHTML.trim() !== '';
             infoDisplay.style.display = currentSettings.isVisible && hasContent ? 'block' : 'none'; // Apply visibility
             if (infoDisplay.style.display === 'block') {
                  requestAnimationFrame(adjustOverlayPosition);
             }
        }
        // applySettings(currentSettings); // ★★★ Removed redundant call ★★★
        return infoDisplay;
    }
  
    // Create new overlay if it doesn't exist
    const playerContainer = document.querySelector('#movie_player');
    if (!playerContainer) return null;
  
    infoDisplay = document.createElement('div');
    infoDisplay.id = 'youtube-codec-info-overlay';
     // ★★★ Apply current settings on creation ★★★
    infoDisplay.style.fontSize = `${currentSettings.overlaySize}px`;
    infoDisplay.innerHTML = ''; // Start empty
     // Initial display state depends on settings, but content is empty, so start hidden
    infoDisplay.style.display = 'none';
    // Visibility will be set correctly when content is added or settings change
  
    playerContainer.appendChild(infoDisplay);
    return infoDisplay;
  }


// --- adjustOverlayPosition (変更なし) ---
function adjustOverlayPosition() {
    const overlay = document.getElementById('youtube-codec-info-overlay');
    if (!overlay || overlay.style.display === 'none') return;
    const player = document.getElementById('movie_player');
    if (!player) return;
    const controls = player.querySelector('.ytp-chrome-bottom');
    const progressBarContainer = player.querySelector('.ytp-progress-bar-container');
    const defaultBottom = '10px';
    const marginAboveControls = 5;
    let targetBottom = defaultBottom;
    if (controls && progressBarContainer) {
        let isControlsVisible = false;
        let controlsHeight = 0;
        try {
            const controlsStyle = window.getComputedStyle(controls);
            const controlsOpacity = parseFloat(controlsStyle.opacity);
            const controlsOffsetHeight = controls.offsetHeight;
            isControlsVisible = controlsOpacity > 0.1 && controlsOffsetHeight > 10;
            if (isControlsVisible) { controlsHeight = controlsOffsetHeight; targetBottom = `${controlsHeight + marginAboveControls}px`; }
        } catch (e) { console.error("[AdjustPos] Error accessing control styles/height:", e); targetBottom = defaultBottom; }
    } else { targetBottom = defaultBottom; }
    if (overlay.style.bottom !== targetBottom) { overlay.style.bottom = targetBottom; }
}


// --- updateCodecInfo (変更なし) ---
function updateCodecInfo() {
  const player = document.getElementById('movie_player');
  const overlay = getOrCreateOverlay();
  if (!player || !overlay) return;
  try { window.postMessage({ type: "GET_CODEC_INFO" }, "*"); } catch (e) { console.error("[Content] Error posting message:", e); injectScript('inject.js'); }
  const currentVideoId = getCurrentVideoId();
  if (currentVideoId && currentVideoId !== lastVideoId) {
     lastVideoId = currentVideoId;
     lastReceivedData = null;
     if (overlay) { overlay.innerHTML = ''; overlay.style.display = 'none'; }
  }
}

// --- getCurrentVideoId (変更なし) ---
function getCurrentVideoId() {
  if (window.location.pathname === '/watch') { const params = new URLSearchParams(window.location.search); return params.get('v'); }
  return null;
}


// Function to build overlay HTML from data and settings
function buildInfoHtml(data) {
    if (!data) return '';

    try {
        // --- Extract data ---
        const videoQuality = data.qualityLabel || data.resolution || (data.height ? `${data.height}p` : '');
        const videoFps = data.fps ? `@${data.fps}` : '';
        const videoCodec = data.videoCodec?.split('.')[0] || 'N/A';
        const audioCodec = data.audioCodec?.split('.')[0] || 'N/A';

        // --- Color Info Extraction ---
        const colorPrimaries = data.colorInfo?.primaries;
        const transferCharacteristics = data.colorInfo?.transferCharacteristics; // Get the value

        // console.log("[BuildHTML] Input transferCharacteristics:", transferCharacteristics); // Keep debug log for now

        // Extract Color Primaries
        let colorSpaceName = '';
        if (colorPrimaries && colorPrimaries.includes('BT')) {
             const match = colorPrimaries.match(/BT\.?(\d+)/i);
             if (match && match[1]) { colorSpaceName = `BT.${match[1]}`; }
             else { colorSpaceName = colorPrimaries.replace('COLOR_PRIMARIES_', '').replace('_', '.');}
        }

        // Determine EOTF Name (Case-insensitive check)
        let eotfName = '';
        if (transferCharacteristics) {
            // ★★★ Convert to lowercase for case-insensitive comparison ★★★
            const lowerCaseTransfer = transferCharacteristics.toLowerCase();
            if (lowerCaseTransfer.includes('smpte_st2084') || lowerCaseTransfer.includes('smptest2084') ) { // Check for 'smpte_st2084' or 'smptest2084' (log showed 'smptest')
                eotfName = 'PQ';
            } else if (lowerCaseTransfer.includes('arib_std_b67')) {
                eotfName = 'HLG';
            }
        }
         console.log("[BuildHTML] Determined colorSpaceName:", colorSpaceName, "| Determined eotfName:", eotfName); // Keep debug log

        const audioSampleRate = data.audioSampleRate ? `${Math.round(parseInt(data.audioSampleRate) / 1000)}kHz` : '';
        const audioChannels = data.audioChannels ? `${data.audioChannels}ch` : '';
        const isLive = data.isLive || false;
        const isDash = data.isDash || false;
        const isMsl = data.isMsl || false;

        // --- Build display string ---
        let infoParts = [];
        let statusParts = [];
        // ... (Video, Resolution, Audio info building は変更なし) ...
        if (currentSettings.showVideoCodec && videoCodec !== 'N/A') { infoParts.push(`🎬 ${videoCodec}`); }
        if (currentSettings.showResolutionFps && videoQuality) { const resFpsString = `${videoQuality}${videoFps}`; if (currentSettings.showVideoCodec && infoParts.length > 0 && videoCodec !== 'N/A') { infoParts[infoParts.length - 1] += ` (${resFpsString})`; } else { infoParts.push(`🖼️ ${resFpsString}`); } }
        if (currentSettings.showAudioCodec && audioCodec !== 'N/A') { infoParts.push(`🔊 ${audioCodec}`); }
        if (currentSettings.showAudioDetails && (audioSampleRate || audioChannels)) { const audioDetails = [audioSampleRate, audioChannels].filter(Boolean).join(', '); if (audioDetails) { if (currentSettings.showAudioCodec && infoParts.length > 0 && infoParts[infoParts.length-1].startsWith('🔊')) { infoParts[infoParts.length - 1] += ` (${audioDetails})`; } else { infoParts.push(`👂 ${audioDetails}`); } } }

        // Color Space & EOTF
        if (currentSettings.showColorSpace && colorSpaceName) {
            let colorString = colorSpaceName;
            // console.log("[BuildHTML] Before EOTF append, colorString:", colorString, "| eotfName:", eotfName); // Keep debug log
            if (eotfName === 'PQ' || eotfName === 'HLG') {
                colorString += ` / ${eotfName}`; // Append EOTF name
            }
             // console.log("[BuildHTML] Final color string:", colorString); // Keep debug log
            infoParts.push(`🎨 ${colorString}`);
        }
        // ... (Stream status building は変更なし) ...
        if (currentSettings.showStreamStatus) { if (isLive) statusParts.push(`🔴 LIVE`); if (isDash) statusParts.push(`DASH`); else if (isMsl) statusParts.push(`HLS`); }

        // Combine parts
        let infoText = infoParts.join(' | ');
        if (statusParts.length > 0) { infoText += (infoText ? '<br>' : '') + statusParts.join(' '); }
        return infoText.trim();

    } catch (e) {
        console.error("[Content] Error building info HTML:", e, data);
        return "Codec Info Error";
    }
}

// Listen for results from inject script
window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data || event.data.type !== "CODEC_INFO_RESULT") return;

  lastReceivedData = event.data.payload; // Store the received data
  const overlay = getOrCreateOverlay();
  if (!overlay) return;

  // ★★★ Log received data, specifically colorInfo ★★★
  console.log("[Content] Received data:", lastReceivedData);
  if(lastReceivedData && lastReceivedData.colorInfo){
      console.log("[Content] Received colorInfo:", lastReceivedData.colorInfo);
      console.log("[Content] Received transferCharacteristics raw value:", lastReceivedData.colorInfo.transferCharacteristics); // Log the raw value
  }
  // ★★★ End Log ★★★

  if (lastReceivedData) {
      const infoText = buildInfoHtml(lastReceivedData); // Use the build function
      overlay.innerHTML = infoText; // Update content first
      const hasContent = infoText !== '';
      const shouldBeVisible = currentSettings.isVisible && hasContent;
      overlay.style.display = shouldBeVisible ? 'block' : 'none'; // Then update visibility
      if (shouldBeVisible) { requestAnimationFrame(adjustOverlayPosition); } // Adjust position if visible
  } else {
     // Handle case where payload is null
     overlay.innerHTML = event.data.error ? `Error: ${event.data.error}` : '';
     overlay.style.display = 'none';
     lastReceivedData = null;
  }
}, false);


// Apply settings from storage or popup (triggers immediate content refresh)
function applySettings(settings) {
  currentSettings = { ...currentSettings, ...settings };
  const overlay = getOrCreateOverlay();
  if (overlay) {
      overlay.style.fontSize = `${currentSettings.overlaySize}px`;
      const newHtml = buildInfoHtml(lastReceivedData);
      overlay.innerHTML = newHtml;
      const hasContent = newHtml !== '';
      const shouldBeVisible = currentSettings.isVisible && hasContent;
      overlay.style.display = shouldBeVisible ? 'block' : 'none';
      if (shouldBeVisible) { requestAnimationFrame(adjustOverlayPosition); }
  }
}

// Load initial settings from storage
function loadInitialSettings() {
  chrome.storage.sync.get(currentSettings, (items) => {
    applySettings(items);
    if (getCurrentVideoId()) {
        setTimeout(updateCodecInfo, 600);
    }
  });
}

// --- Listeners (Message, Storage) ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SETTINGS_UPDATED") { applySettings(request.payload); sendResponse({ status: "Settings applied" }); }
    return true;
});
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') { const changedKeys = Object.keys(changes); if (changedKeys.some(key => key in currentSettings)) { loadInitialSettings(); } }
});

function startChecking() {
    if (checkInterval) return;
    // console.log("[Content] Starting periodic check...");

    const checkInjectLoaded = setInterval(() => {
        const injectorScript = document.getElementById('codec-info-injector-script');
        if (injectorScript && typeof window.postMessage === 'function') {
            clearInterval(checkInjectLoaded);
            // console.log("[Content] Inject script confirmed. Starting updates.");
            // Initial update request handled elsewhere

            checkInterval = setInterval(() => {
                try {
                    if(getCurrentVideoId()) {
                        // Data update frequency can be less frequent than position check if needed
                        updateCodecInfo(); // Still update data (maybe less often later?)
                        adjustOverlayPosition(); // Position check runs more often
                    }
                } catch (error) {
                    console.error("[Content] Error inside setInterval callback:", error);
                }
                // ★★★ Change interval from 200 to 100 ★★★
            }, 100); // Check every 100ms (0.1 seconds)
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
 function stopChecking() { if (checkInterval) { clearInterval(checkInterval); checkInterval = null; } }
 function observePlayerAndNavigation() {
     if (observer) observer.disconnect();
     const targetNode = document.body;
     const config = { childList: true, subtree: true };
     let currentHref = document.location.href;
     let navigationDebounceTimer = null;
     let playerCheckDebounceTimer = null;
     observer = new MutationObserver((mutationsList, observer) => {
         clearTimeout(navigationDebounceTimer);
         navigationDebounceTimer = setTimeout(() => { if (document.location.href !== currentHref) { currentHref = document.location.href; handleNavigation(); } }, 100);
         let playerFound = false; let playerRemoved = false;
         for(const mutation of mutationsList) { if (mutation.type === 'childList') { mutation.addedNodes.forEach(node => { if (node.nodeType === 1 && (node.id === 'movie_player' || (node.querySelector && node.querySelector('#movie_player')))) playerFound = true; }); mutation.removedNodes.forEach(node => { if (node.nodeType === 1 && node.id === 'movie_player') playerRemoved = true; }); } if (playerFound || playerRemoved) break; }
         if (playerFound || playerRemoved) { clearTimeout(playerCheckDebounceTimer); playerCheckDebounceTimer = setTimeout(() => { handleNavigation(); }, 200); }
     });
     observer.observe(targetNode, config);
 }
 function handleNavigation() {
     const isOnWatchPage = getCurrentVideoId();
     const player = document.getElementById('movie_player');
     if (isOnWatchPage && player) {
         if (!checkInterval) { injectScript('inject.js'); getOrCreateOverlay(); loadInitialSettings(); startChecking(); }
         else { getOrCreateOverlay(); requestAnimationFrame(adjustOverlayPosition); updateCodecInfo(); }
     } else { if (checkInterval) { stopChecking(); } const overlay = document.getElementById('youtube-codec-info-overlay'); if (overlay) overlay.style.display = 'none'; lastVideoId = null; lastReceivedData = null; }
 }

 // --- Initialization ---
 loadInitialSettings();
 if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', observePlayerAndNavigation); }
 else { observePlayerAndNavigation(); }
 window.addEventListener('beforeunload', () => { stopChecking(); if(observer) observer.disconnect(); });