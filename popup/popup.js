const visibilityToggle = document.getElementById('toggle-visibility');
const sizeSlider = document.getElementById('size-slider');
const sizeValueSpan = document.getElementById('size-value');
const explanationArea = document.getElementById('explanation-area'); // Get explanation area

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

// --- Explanations and Links ---
const explanations = {
  showOverlay: { // Added explanation for main toggle
    text: "オーバーレイ全体の表示・非表示を切り替えます。",
    wikiLink: null // No relevant link
  },
  fontSize: { // Added explanation for font size
    text: "オーバーレイに表示される文字の大きさを調整します。",
    wikiLink: null
  },
  videoCodec: {
    text: "動画を圧縮・展開する技術。新しいほど圧縮効率が高い傾向があります。(例: AV1, VP9, AVC)",
    wikiLink: "https://ja.wikipedia.org/wiki/%E3%82%B3%E3%83%BC%E3%83%87%E3%83%83%E3%82%AF" // コーデック
  },
  resolutionFps: {
    text: "解像度は動画の精細さ(横x縦ピクセル)、FPSは1秒間のコマ数で滑らかさを示します。",
    wikiLink: "https://ja.wikipedia.org/wiki/%E7%94%BB%E9%9D%A2%E8%A7%A3%E5%83%8F%E5%BA%A6", // 画面解像度
    fpsWikiLink: "https://ja.wikipedia.org/wiki/%E3%83%95%E3%83%AC%E3%83%BC%E3%83%A0%E3%83%AC%E3%83%BC%E3%83%88" // フレームレート
  },
  audioCodec: {
    text: "音声を圧縮・展開する技術。低遅延・高品質なOpus、広く使われるAACなどがあります。",
    wikiLink: "https://ja.wikipedia.org/wiki/%E9%9F%B3%E5%A3%B0%E3%82%B3%E3%83%BC%E3%83%87%E3%83%83%E3%82%AF" // 音声コーデック
  },
  audioDetails: {
    text: "サンプルレート(kHz)は1秒間の音の標本数、チャンネル数(ch)は音声のトラック数(2ch=ステレオ)。",
    wikiLink: "https://ja.wikipedia.org/wiki/%E6%A8%99%E6%9C%AC%E5%8C%96%E5%91%A8%E6%B3%A2%E6%95%B0", // サンプリング周波数
    channelWikiLink: "https://ja.wikipedia.org/wiki/%E3%82%B5%E3%83%A9%E3%82%A6%E3%83%B3%E3%83%89" // サラウンド (チャンネル数の概念)
  },
  colorSpace: {
    text: "色空間(色域)は表現できる色の範囲(BT.709=SDR, BT.2020=HDR)。伝達特性(EOTF)は明るさの表現方法(PQ/HLG=HDR)。",
    wikiLink: "https://ja.wikipedia.org/wiki/Rec._2020", // Rec. 2020 (BT.2020)
    eotfWikiLink: "https://ja.wikipedia.org/wiki/%E3%83%8F%E3%82%A4%E3%83%80%E3%82%A4%E3%83%8A%E3%83%9F%E3%83%83%E3%82%AF%E3%83%AC%E3%83%B3%E3%82%B8%E6%98%A0%E5%83%8F#EOTF" // HDR EOTF
  },
  streamStatus: {
    text: "LIVEは生放送。DASHやHLSは映像を分割し効率的に配信するストリーミング技術です。",
    wikiLink: "https://ja.wikipedia.org/wiki/Dynamic_Adaptive_Streaming_over_HTTP", // DASH
    hlsWikiLink: "https://ja.wikipedia.org/wiki/HTTP_Live_Streaming" // HLS
  }
};

// --- Function to show explanation ---
function showExplanation(key) {
    const explanationData = explanations[key];
    if (!explanationData || !explanationArea) return;

    // Find the label associated with the help icon (matching the key)
    // The key for info toggles matches the input ID (e.g., 'toggle-video-codec')
    // For others, we use the specific help icon ID's key
    let labelText = '';
    let labelElement = null;
    if (key === 'showOverlay') labelElement = document.querySelector("label[for='toggle-visibility']");
    else if (key === 'fontSize') labelElement = document.querySelector("label[for='size-slider']");
    else labelElement = document.querySelector(`label[for='toggle-${key}']`); // Assumes key matches toggle ID suffix

    if (labelElement) {
        labelText = labelElement.innerText; // Get the text from the corresponding label
    } else {
        // Fallback title if label not found (shouldn't happen with correct IDs)
        labelText = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }


    let html = `<p><strong>${labelText}:</strong><br>${explanationData.text}</p>`;
    // Add primary wiki link
    if (explanationData.wikiLink) {
        html += `<a href="${explanationData.wikiLink}" target="_blank" class="wiki-link">詳細 (Wikipedia)</a>`;
    }
    // Add secondary links if they exist
    if (explanationData.fpsWikiLink) {
        html += ` | <a href="${explanationData.fpsWikiLink}" target="_blank" class="wiki-link">FPS詳細</a>`;
    }
     if (explanationData.channelWikiLink) {
         html += ` | <a href="${explanationData.channelWikiLink}" target="_blank" class="wiki-link">チャンネル詳細</a>`;
     }
     if (explanationData.eotfWikiLink) {
         html += ` | <a href="${explanationData.eotfWikiLink}" target="_blank" class="wiki-link">EOTF詳細</a>`;
     }
     if (explanationData.hlsWikiLink) {
         html += ` | <a href="${explanationData.hlsWikiLink}" target="_blank" class="wiki-link">HLS詳細</a>`;
     }

    explanationArea.innerHTML = html;
    explanationArea.style.display = 'block';

    // Add listener to hide explanation when clicking outside
    setTimeout(() => { // Use timeout to prevent immediate closing by the same click
        document.addEventListener('click', hideExplanationOnClickOutside, { once: true, capture: true });
    }, 0);
}

// --- Function to hide explanation ---
function hideExplanationOnClickOutside(event) {
    if (!explanationArea) return;
    // Check if the click was outside the explanation area and not on any help icon
    if (!explanationArea.contains(event.target) && !event.target.classList.contains('help-icon')) {
        explanationArea.style.display = 'none';
        // Remove the listener after hiding (or it stays active) - not needed with { once: true }
    } else {
         // If clicked inside or on an icon, re-attach the listener for the next click outside
          document.addEventListener('click', hideExplanationOnClickOutside, { once: true, capture: true });
    }
}


// --- Load Settings ---
function loadSettings() {
  chrome.storage.sync.get(defaultSettings, (items) => {
    visibilityToggle.checked = items.isVisible;
    sizeSlider.value = items.overlaySize;
    sizeValueSpan.textContent = `${items.overlaySize}px`;
    for (const key in infoToggles) {
      if (infoToggles[key] && items.hasOwnProperty(key)) {
        infoToggles[key].checked = items[key];
      }
    }
  });
}

// --- Save Settings ---
function saveSettings() {
  const isVisible = visibilityToggle.checked;
  const overlaySize = parseInt(sizeSlider.value, 10);
  const infoSettings = {};
  for (const key in infoToggles) {
    if (infoToggles[key]) { infoSettings[key] = infoToggles[key].checked; }
  }
  const settingsToSave = { isVisible, overlaySize, ...infoSettings };

  chrome.storage.sync.set(settingsToSave, () => {
    // console.log('Settings saved:', settingsToSave);
    notifyContentScript({ type: 'SETTINGS_UPDATED', payload: settingsToSave });
  });
}

// --- Notify Content Script ---
function notifyContentScript(message) {
  chrome.tabs.query({ active: true, currentWindow: true, url: "*://*.youtube.com/*" }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
        if (chrome.runtime.lastError) { /* Handle error */ }
      });
    }
  });
}

// --- Event Listeners ---
visibilityToggle.addEventListener('change', saveSettings);
sizeSlider.addEventListener('input', () => { sizeValueSpan.textContent = `${sizeSlider.value}px`; });
sizeSlider.addEventListener('change', saveSettings);
for (const key in infoToggles) {
  if (infoToggles[key]) { infoToggles[key].addEventListener('change', saveSettings); }
}

// Add listeners for help icons
document.getElementById('help-show-overlay')?.addEventListener('click', (e) => { e.stopPropagation(); showExplanation('showOverlay'); });
document.getElementById('help-font-size')?.addEventListener('click', (e) => { e.stopPropagation(); showExplanation('fontSize'); });
document.getElementById('help-videoCodec')?.addEventListener('click', (e) => { e.stopPropagation(); showExplanation('videoCodec'); });
document.getElementById('help-resolutionFps')?.addEventListener('click', (e) => { e.stopPropagation(); showExplanation('resolutionFps'); });
document.getElementById('help-audioCodec')?.addEventListener('click', (e) => { e.stopPropagation(); showExplanation('audioCodec'); });
document.getElementById('help-audioDetails')?.addEventListener('click', (e) => { e.stopPropagation(); showExplanation('audioDetails'); });
document.getElementById('help-colorSpace')?.addEventListener('click', (e) => { e.stopPropagation(); showExplanation('colorSpace'); });
document.getElementById('help-streamStatus')?.addEventListener('click', (e) => { e.stopPropagation(); showExplanation('streamStatus'); });


// Initial Load
document.addEventListener('DOMContentLoaded', loadSettings);