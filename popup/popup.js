const visibilityToggle = document.getElementById('toggle-visibility');
const sizeSlider = document.getElementById('size-slider');
const sizeValueSpan = document.getElementById('size-value');

function loadSettings() {
  chrome.storage.sync.get({ isVisible: true, overlaySize: 13 }, (items) => {
    visibilityToggle.checked = items.isVisible;
    sizeSlider.value = items.overlaySize;
    sizeValueSpan.textContent = `${items.overlaySize}px`;
  });
}

function saveSettings() {
  const isVisible = visibilityToggle.checked;
  const overlaySize = parseInt(sizeSlider.value, 10);

  chrome.storage.sync.set({ isVisible, overlaySize }, () => {
    // console.log('Settings saved:', { isVisible, overlaySize }); // Log commented out
    notifyContentScript({ type: 'SETTINGS_UPDATED', payload: { isVisible, overlaySize } });
  });
}

function notifyContentScript(message) {
  chrome.tabs.query({ active: true, currentWindow: true, url: "*://*.youtube.com/*" }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
        if (chrome.runtime.lastError) {
          // console.log('Could not send message to content script on active tab:', chrome.runtime.lastError.message); // Log commented out
        } else {
          // console.log('Message sent to active content script, response:', response); // Log commented out
        }
      });
    } else {
        // console.log('No active YouTube tab found in current window.'); // Log commented out
    }
  });
}

visibilityToggle.addEventListener('change', saveSettings);
sizeSlider.addEventListener('input', () => {
  sizeValueSpan.textContent = `${sizeSlider.value}px`;
});
sizeSlider.addEventListener('change', saveSettings);

document.addEventListener('DOMContentLoaded', loadSettings);