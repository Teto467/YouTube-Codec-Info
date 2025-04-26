// content.js (修正版 v2)

console.log("YouTube Codec Info extension loaded. v2");

let infoDisplay = null;
let lastVideoId = null;
let checkInterval = null; // setIntervalのIDを保持
let observer = null; // MutationObserver用

// ページコンテキストで実行するスクリプトを挿入する関数
function injectScript(filePath) {
  // 既に挿入されていないか確認
  const existingScript = document.getElementById('codec-info-injector-script');
  if (existingScript) {
      // console.log("[Content] Injector script already present.");
      // 既に存在する場合でも、メッセージリスナーが機能するように念のため再挿入を試みるか、
      // または何もしない。ここでは何もしない戦略をとる。
      return;
  }
  const script = document.createElement('script');
  script.id = 'codec-info-injector-script'; // IDを付与して重複挿入を防ぐ
  script.src = chrome.runtime.getURL(filePath);
  script.onload = function() {
    console.log(`[Content] ${filePath} injected and loaded.`);
    // this.remove(); // スクリプト実行後も残しておく（デバッグのため）
  };
  script.onerror = function() {
      console.error(`[Content] Failed to load ${filePath}`);
  };
  (document.head || document.documentElement).appendChild(script);
}

// UI要素を作成または取得する関数
function getOrCreateOverlay() {
  const existingOverlay = document.getElementById('youtube-codec-info-overlay');
  if (existingOverlay) {
      infoDisplay = existingOverlay;
      // プレイヤーが再生成された場合に備えて、正しい位置にあるか確認・移動
      const playerContainer = document.querySelector('#movie_player');
      if (playerContainer && !playerContainer.contains(infoDisplay)) {
          console.log("[Content] Moving overlay to current player container.");
          playerContainer.appendChild(infoDisplay);
      }
      return infoDisplay;
  }

  const playerContainer = document.querySelector('#movie_player'); // プレイヤーのコンテナ要素
  if (!playerContainer) {
       // console.log("[Content] Player container not found for overlay creation.");
       return null;
  }

  infoDisplay = document.createElement('div');
  infoDisplay.id = 'youtube-codec-info-overlay';
  infoDisplay.style.display = 'none'; // 初期状態は非表示
  playerContainer.appendChild(infoDisplay); // プレイヤーコンテナに追加
  console.log("[Content] Codec info overlay created.");
  return infoDisplay;
}

// コーデック情報を取得して表示を更新する関数
function updateCodecInfo() {
  // console.log("[Content] Attempting to update codec info...");
  const player = document.getElementById('movie_player');
  const overlay = getOrCreateOverlay(); // 毎回取得を試みる

  if (!player || !overlay) {
    // console.log("[Content] Player or overlay not available yet.");
    return;
  }

  // inject.js に情報取得を依頼
  // console.log("[Content] Posting GET_CODEC_INFO message to window.");
  try {
      window.postMessage({ type: "GET_CODEC_INFO" }, "*");
  } catch (e) {
      console.error("[Content] Error posting message:", e);
      // postMessageが失敗する場合、inject.jsがロードされていない可能性
      injectScript('inject.js'); // 再度injectを試みる
  }


  // 現在の動画IDを取得 (変更チェック用)
  const currentVideoId = getCurrentVideoId();
  if (currentVideoId && currentVideoId !== lastVideoId) {
     console.log(`[Content] Video changed: ${lastVideoId} -> ${currentVideoId}`);
     lastVideoId = currentVideoId;
     if (overlay) overlay.style.display = 'none'; // 動画が変わったら一旦非表示
  }
}

// 現在の動画IDを取得するヘルパー関数
function getCurrentVideoId() {
  if (window.location.pathname === '/watch') {
    const params = new URLSearchParams(window.location.search);
    return params.get('v');
  }
  return null;
}

// inject.jsからのメッセージを受け取るリスナー
window.addEventListener("message", (event) => {
  // We only accept messages from ourselves (inject script via window)
  if (event.source !== window || !event.data || event.data.type !== "CODEC_INFO_RESULT") {
    // 他の拡張機能などからのメッセージは無視
    // console.log("[Content] Ignoring message:", event.data);
    return;
  }

  console.log("[Content] Received CODEC_INFO_RESULT:", event.data.payload);
  const data = event.data.payload;
  const overlay = getOrCreateOverlay(); // 再度取得

  if (!overlay) {
      console.warn("[Content] Overlay not found when receiving result.");
      return;
  }

  if (data) {
    try {
        // 情報が見つからない場合は 'N/A' や空文字になる可能性があるため、デフォルト値を設定
        const videoQuality = data.qualityLabel || data.resolution || (data.height ? `${data.height}p` : '');
        const videoFps = data.fps ? `@${data.fps}` : '';
        const videoCodec = data.videoCodec?.split('.')[0] || 'N/A'; // avc1.xxxxx -> avc1
        const audioCodec = data.audioCodec?.split('.')[0] || 'N/A'; // mp4a.xxxxx -> mp4a
        const colorPrimaries = data.colorInfo?.primaries?.replace('COLOR_PRIMARIES_', '') || ''; // COLOR_PRIMARIES_BT709 -> BT709
        const colorTransfer = data.colorInfo?.transferCharacteristics?.replace('COLOR_TRANSFER_', '') || '';
        const colorMatrix = data.colorInfo?.matrixCoefficients?.replace('COLOR_MATRIX_', '') || '';
        // 例: BT709 / BT709 / BT709
        const colorInfo = [colorPrimaries, colorTransfer, colorMatrix].filter(Boolean).map(s => s.toUpperCase()).join(' / ');
        const audioSampleRate = data.audioSampleRate ? `${Math.round(parseInt(data.audioSampleRate) / 1000)}kHz` : '';
        const audioChannels = data.audioChannels ? `${data.audioChannels}ch` : '';

        let infoParts = [];
        if (videoCodec !== 'N/A') {
            let videoStr = `🎬 ${videoCodec}`;
            if (videoQuality) videoStr += ` (${videoQuality}${videoFps})`;
            infoParts.push(videoStr);
        }
        // if (colorInfo) infoParts.push(`🎨 ${colorInfo}`); // 色空間情報は冗長ならコメントアウト
        if (audioCodec !== 'N/A') {
            let audioStr = `🔊 ${audioCodec}`;
            let audioDetails = [audioSampleRate, audioChannels].filter(Boolean).join(', ');
            if (audioDetails) audioStr += ` (${audioDetails})`;
            infoParts.push(audioStr);
        }
        if (colorInfo) infoParts.push(`🎨 ${colorInfo}`); // 末尾に移動

        let statusFlags = [];
        if(data.isLive) statusFlags.push(`🔴 LIVE`);
        if(data.isDash) statusFlags.push(`DASH`);
        else if (data.isMsl) statusFlags.push(`HLS`); // DASHとHLSは排他的と仮定

        let infoText = infoParts.join(' | ');
        if (statusFlags.length > 0) {
            // ステータス情報は改行して表示
            infoText += `<br>${statusFlags.join(' ')}`;
        }

        // itagやビットレートなどの詳細情報（必要なら追加）
        // if (data.itag) infoText += `<br>itag: ${data.itag}`;
        // if (data.bitrate) infoText += `<br>Bitrate: ${Math.round(data.bitrate / 1000)}kbps`;


        if (infoText.trim() === '' || (videoCodec === 'N/A' && audioCodec === 'N/A')) {
             console.log("[Content] No meaningful codec info to display.");
             overlay.style.display = 'none'; // 表示する情報がなければ非表示
        } else {
            overlay.innerHTML = infoText;
            overlay.style.display = 'block'; // 情報を表示
            // console.log("[Content] Overlay updated.");
        }

    } catch (e) {
        console.error("[Content] Error parsing codec info:", e, data);
        if (overlay) { // エラー時も表示を試みる
           overlay.innerHTML = "Codec Info Error";
           overlay.style.display = 'block';
        }
    }

  } else {
     if (overlay) overlay.style.display = 'none'; // 情報がnullなら非表示
     console.log("[Content] No codec info payload received from inject script.");
  }
}, false);

// --- 定期チェックの開始と停止 ---
function startChecking() {
    if (checkInterval) return; // 既に実行中なら何もしない
    console.log("[Content] Starting periodic check...");

    // injectスクリプトがロードされていることを確認してから開始
    const checkInjectLoaded = setInterval(() => {
        if (document.getElementById('codec-info-injector-script')) {
            clearInterval(checkInjectLoaded);
            console.log("[Content] Inject script confirmed. Starting updates.");
            // 初回実行（少し遅らせる）
            setTimeout(() => {
                if(getCurrentVideoId()) updateCodecInfo(); // 動画ページにいる場合のみ初回実行
            }, 500); // 少し短縮
            // 定期実行
            checkInterval = setInterval(() => {
                if(getCurrentVideoId()) { // 動画ページにいる場合のみチェック
                    updateCodecInfo();
                }
            }, 3000); // 3秒ごと
        } else {
             console.log("[Content] Waiting for inject script to load...");
             // injectがまだなければ再試行
             injectScript('inject.js');
        }
    }, 500); // 500msごとにinjectスクリプトの存在確認

    // タイムアウトを設定（例: 10秒待ってもinjectされなければ諦める）
    setTimeout(() => {
       if (!checkInterval) {
           clearInterval(checkInjectLoaded);
           console.error("[Content] Inject script did not load within timeout.");
       }
    }, 10000);
}

function stopChecking() {
    if (checkInterval) {
        console.log("[Content] Stopping periodic check.");
        clearInterval(checkInterval);
        checkInterval = null;
    }
     const overlay = document.getElementById('youtube-codec-info-overlay');
     if (overlay && overlay.parentNode) {
         // すぐに消さずに、非表示にするだけにする（再表示がスムーズなように）
         overlay.style.display = 'none';
         // overlay.parentNode.removeChild(overlay);
         // infoDisplay = null;
     }
}

// --- プレイヤー要素とURLの監視 (SPA対応) ---
function observePlayerAndNavigation() {
    if (observer) observer.disconnect(); // 既存のObserverがあれば停止

    const targetNode = document.body;
    // #movie_player の追加/削除と、URL変更を引き起こす可能性のある属性変化を監視
    const config = { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'src'] };

    let currentHref = document.location.href; // 現在のURLを保持

    observer = new MutationObserver((mutationsList, observer) => {
        // URLが変わったかチェック (SPAナビゲーション対応)
        if (document.location.href !== currentHref) {
            console.log(`[Content] URL changed: ${currentHref} -> ${document.location.href}`);
            currentHref = document.location.href;
            handleNavigation();
        }

        // DOM変更の中にプレイヤー関連のものがないかチェック
        let playerFound = false;
        let playerRemoved = false;
        for(const mutation of mutationsList) {
             if (mutation.type === 'childList') {
                // 追加されたノードをチェック
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && (node.id === 'movie_player' || node.querySelector('#movie_player'))) {
                        playerFound = true;
                    }
                });
                 // 削除されたノードをチェック
                 mutation.removedNodes.forEach(node => {
                     if (node.nodeType === 1 && node.id === 'movie_player') {
                         playerRemoved = true;
                     }
                 });
            }
        }

        if (playerFound || playerRemoved) {
             console.log(`[Content] Player status change detected (Found: ${playerFound}, Removed: ${playerRemoved})`);
             handleNavigation(); // URL変更と同様の処理を行う
        }
    });

    console.log("[Content] Starting MutationObserver for player and navigation.");
    observer.observe(targetNode, config);

    // 初期状態の処理
    handleNavigation();
}

// ナビゲーションやプレイヤー状態の変化に対応する関数
function handleNavigation() {
    const isOnWatchPage = getCurrentVideoId();
    const player = document.getElementById('movie_player');

    if (isOnWatchPage && player) {
        // 動画ページでプレイヤーが存在する場合
        if (!checkInterval) { // まだチェックが開始されていなければ
            console.log("[Content] Watch page and player detected. Initializing...");
            injectScript('inject.js'); // injectスクリプトを（必要なら）挿入
            getOrCreateOverlay(); // オーバーレイを（必要なら）作成
            startChecking();    // 定期チェックを開始
        } else {
            // console.log("[Content] Watch page and player confirmed. Check already running.");
            // 必要ならオーバーレイを再表示
            const overlay = getOrCreateOverlay();
            if(overlay && overlay.style.display === 'none' && overlay.innerHTML.trim() !== '') {
                // overlay.style.display = 'block';
                // すぐに表示せず、次のupdateCodecInfoで内容が更新されてから表示されるのを待つ
            }
             // 動画が切り替わった可能性があるので一度更新をかける
             updateCodecInfo();
        }
    } else {
        // 動画ページでない、またはプレイヤーが存在しない場合
        if (checkInterval) { // チェックが実行中なら
            console.log("[Content] Not on watch page or player not found. Stopping check.");
            stopChecking(); // 定期チェックを停止
        } else {
            // console.log("[Content] Not on watch page or player not found. Check already stopped.");
        }
    }
}


// --- 初期化 ---
// プレイヤーとナビゲーションの監視を開始
observePlayerAndNavigation();

// ページ離脱時にリソースをクリーンアップ
window.addEventListener('beforeunload', () => {
    stopChecking();
    if(observer) observer.disconnect();
    // injectスクリプトやオーバーレイ要素を削除する（オプション）
    const injectedScript = document.getElementById('codec-info-injector-script');
    if (injectedScript && injectedScript.parentNode) injectedScript.parentNode.removeChild(injectedScript);
    const overlay = document.getElementById('youtube-codec-info-overlay');
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
});

console.log("YouTube Codec Info content script initialized. v2");