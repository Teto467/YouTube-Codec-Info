const visibilityToggle = document.getElementById('toggle-visibility');
const sizeSlider = document.getElementById('size-slider');
const sizeValueSpan = document.getElementById('size-value');

// Info toggle checkboxes
const infoToggles = {
  showVideoCodec: document.getElementById('toggle-video-codec'),
  showResolutionFps: document.getElementById('toggle-resolution-fps'),
  showAudioCodec: document.getElementById('toggle-audio-codec'),
  showAudioDetails: document.getElementById('toggle-audio-details'),
  showColorSpace: document.getElementById('toggle-color-space'),
  showStreamStatus: document.getElementById('toggle-stream-status'),
};

// Default settings structure
const defaultSettings = {
    isVisible: true,
    overlaySize: 13,
    showVideoCodec: true,
    showResolutionFps: true,
    showAudioCodec: true,
    showAudioDetails: true,
    showColorSpace: true,
    showStreamStatus: true,
};

// --- 初期設定の読み込みとUIへの反映 ---
function loadSettings() {
  chrome.storage.sync.get(defaultSettings, (items) => {
    visibilityToggle.checked = items.isVisible;
    sizeSlider.value = items.overlaySize;
    sizeValueSpan.textContent = `${items.overlaySize}px`;

    // Apply loaded settings to info toggles
    for (const key in infoToggles) {
      if (infoToggles[key] && items.hasOwnProperty(key)) {
        infoToggles[key].checked = items[key];
      }
    }
  });
}

// --- 設定の保存とコンテンツスクリプトへの通知 ---
function saveSettings() {
  const isVisible = visibilityToggle.checked;
  const overlaySize = parseInt(sizeSlider.value, 10);

  // Get current state of info toggles
  const infoSettings = {};
  for (const key in infoToggles) {
    if (infoToggles[key]) {
      infoSettings[key] = infoToggles[key].checked;
    }
  }

  const settingsToSave = {
    isVisible,
    overlaySize,
    ...infoSettings // Merge info settings
  };

  // 設定を保存
  chrome.storage.sync.set(settingsToSave, () => {
    // console.log('Settings saved:', settingsToSave);
    // アクティブなYouTubeタブにメッセージを送信
    notifyContentScript({ type: 'SETTINGS_UPDATED', payload: settingsToSave });
  });
}

// --- コンテンツスクリプトへメッセージを送信する関数 ---
function notifyContentScript(message) {
  chrome.tabs.query({ active: true, currentWindow: true, url: "*://*.youtube.com/*" }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
        if (chrome.runtime.lastError) {
          // console.log('Could not send message to content script on active tab:', chrome.runtime.lastError.message);
        } else {
          // console.log('Message sent to active content script, response:', response);
        }
      });
    } else {
        // console.log('No active YouTube tab found in current window.');
    }
  });
}

// --- イベントリスナーの設定 ---
visibilityToggle.addEventListener('change', saveSettings);
sizeSlider.addEventListener('input', () => {
  sizeValueSpan.textContent = `${sizeSlider.value}px`;
});
sizeSlider.addEventListener('change', saveSettings);

// Add listeners for info toggles
for (const key in infoToggles) {
  if (infoToggles[key]) {
    infoToggles[key].addEventListener('change', saveSettings);
  }
}

// ポップアップが開かれたときに設定を読み込む
document.addEventListener('DOMContentLoaded', loadSettings);