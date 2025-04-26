// inject.js (修正版 v2)

// スクリプトが複数回ロードされてもリスナーが重複しないようにする
if (window.codecInfoInjectListenerAttached) {
    // console.log("[Inject] Listener already attached. Skipping setup.");
} else {
    window.codecInfoInjectListenerAttached = true;
    console.log("[Inject] Script running. Setting up listener.");

    window.addEventListener("message", (event) => {
        // content scriptからのメッセージのみ受け付ける
        if (event.source !== window || !event.data || event.data.type !== "GET_CODEC_INFO") {
            return;
        }

        // console.log("[Inject] Received GET_CODEC_INFO request.");

        let codecInfo = null;
        const player = document.getElementById('movie_player');

        try {
            if (!player) {
                console.warn("[Inject] Movie player element (#movie_player) not found.");
                window.postMessage({ type: "CODEC_INFO_RESULT", payload: null, error: "Player element not found" }, "*");
                return;
            }

            // 優先度1: player.getPlayerResponse()
            let playerResponse = null;
            if (typeof player.getPlayerResponse === 'function') {
                playerResponse = player.getPlayerResponse();
                // console.log("[Inject] player.getPlayerResponse() available:", playerResponse);
            } else {
                console.log("[Inject] player.getPlayerResponse() not available.");
            }

            // 優先度2: window.ytplayer.config.args.player_response (フォールバック)
            if (!playerResponse && window.ytplayer && window.ytplayer.config && window.ytplayer.config.args && window.ytplayer.config.args.player_response) {
                console.log("[Inject] Trying ytplayer.config.args.player_response as fallback.");
                try {
                    playerResponse = typeof window.ytplayer.config.args.player_response === 'string'
                        ? JSON.parse(window.ytplayer.config.args.player_response)
                        : window.ytplayer.config.args.player_response;
                } catch (e) {
                    console.error("[Inject] Error parsing ytplayer.config.args.player_response:", e);
                    playerResponse = null;
                }
            }

            if (!playerResponse) {
                 console.warn("[Inject] Could not retrieve playerResponse data.");
                 // デバッグ用にgetVideoStats()も試す (存在すれば)
                 if (typeof player.getVideoStats === 'function') {
                     const stats = player.getVideoStats();
                     console.log("[Inject] Debug: player.getVideoStats() result:", stats);
                     // TODO: statsから情報を抽出するロジックを追加（必要なら）
                 }
                 window.postMessage({ type: "CODEC_INFO_RESULT", payload: null, error: "Could not retrieve playerResponse" }, "*");
                 return;
            }

            // playerResponse から情報を解析
            if (playerResponse && playerResponse.streamingData) {
                // console.log("[Inject] Parsing playerResponse.streamingData...");
                const videoDetails = playerResponse.videoDetails;
                const streamingData = playerResponse.streamingData;
                const adaptiveFormats = streamingData.adaptiveFormats || [];
                const formats = streamingData.formats || []; // 通常フォーマット
                const allFormats = [...adaptiveFormats, ...formats];

                if (allFormats.length === 0) {
                     console.warn("[Inject] No formats found in streamingData.");
                     window.postMessage({ type: "CODEC_INFO_RESULT", payload: null, error: "No formats found" }, "*");
                     return;
                }

                // 現在再生中のフォーマットを推定
                let currentVideoFormat = null;
                let currentAudioFormat = null;
                let currentQualityLabel = null;
                let currentHeight = null;
                let currentItag = null; // 現在のitagを取得できればベスト

                // プレイヤーAPIから現在の状態を取得
                if (typeof player.getPlaybackQuality === 'function') {
                    currentQualityLabel = player.getPlaybackQuality();
                    // console.log(`[Inject] Current quality label: ${currentQualityLabel}`);
                }
                 if (typeof player.getVideoHeight === 'function') {
                    currentHeight = player.getVideoHeight();
                     // console.log(`[Inject] Current video height: ${currentHeight}`);
                 }
                 // getVideoData() は詳細情報を含むが、常に利用可能とは限らない
                 if (typeof player.getVideoData === 'function') {
                    const videoData = player.getVideoData();
                    currentItag = videoData?.itag;
                    // if(currentItag) console.log(`[Inject] Current itag from getVideoData: ${currentItag}`);
                 }


                // 1. itag でビデオフォーマットを検索
                if (currentItag) {
                    currentVideoFormat = allFormats.find(f => f.itag === currentItag && f.mimeType?.startsWith('video/'));
                }

                // 2. itagで見つからない場合、品質ラベルや解像度で推定
                if (!currentVideoFormat) {
                    // console.log("[Inject] Finding video format by quality/height...");
                    // adaptiveFormatsを優先
                    currentVideoFormat = adaptiveFormats.find(f => f.qualityLabel === currentQualityLabel && f.mimeType?.startsWith('video/')) ||
                                        adaptiveFormats.find(f => f.height === currentHeight && f.mimeType?.startsWith('video/')) ||
                                        formats.find(f => f.qualityLabel === currentQualityLabel) || // 通常フォーマットも検索
                                        formats.find(f => f.height === currentHeight);
                }

                // 3. それでも見つからない場合のフォールバック
                if (!currentVideoFormat) {
                    // console.log("[Inject] Fallback: Finding any available video format...");
                    currentVideoFormat = adaptiveFormats.find(f => f.mimeType?.startsWith('video/vp9')) || // VP9優先
                                    adaptiveFormats.find(f => f.mimeType?.startsWith('video/av01')) || // AV1
                                    adaptiveFormats.find(f => f.mimeType?.startsWith('video/avc1')) || // AVC1
                                    adaptiveFormats.find(f => f.mimeType?.startsWith('video/')) || // その他のビデオ
                                    formats.find(f => f.mimeType?.startsWith('video/')); // 通常フォーマットのビデオ
                }

                // 音声フォーマットを検索 (通常はadaptiveのみ)
                // ビデオで使用している itag に関連付けられた音声を探すのが理想だが、直接的なリンクがない場合が多い
                // 一般的な Opus または AAC を探す
                currentAudioFormat = adaptiveFormats.find(f => f.mimeType?.startsWith('audio/opus')) ||
                                    adaptiveFormats.find(f => f.mimeType?.startsWith('audio/mp4a')) || // AAC
                                    adaptiveFormats.find(f => f.mimeType?.startsWith('audio/')); // その他の音声

                if (!currentVideoFormat && !currentAudioFormat) {
                     console.warn("[Inject] Could not determine current video or audio format.");
                     window.postMessage({ type: "CODEC_INFO_RESULT", payload: null, error: "Could not determine format" }, "*");
                     return;
                }

                 // console.log("[Inject] Determined Video Format:", currentVideoFormat);
                 // console.log("[Inject] Determined Audio Format:", currentAudioFormat);


                // 情報を抽出して codecInfo オブジェクトを作成
                const videoCodecMatch = currentVideoFormat?.mimeType?.match(/codecs="([^,"]+)/);
                const audioCodecMatch = currentAudioFormat?.mimeType?.match(/codecs="([^"]+)"/);

                codecInfo = {
                    videoCodec: videoCodecMatch ? videoCodecMatch[1] : (currentVideoFormat ? 'N/A' : null), // ビデオフォーマット自体が見つからない場合はnull
                    audioCodec: audioCodecMatch ? audioCodecMatch[1] : (currentAudioFormat ? 'N/A' : null), // オーディオフォーマット自体が見つからない場合はnull
                    qualityLabel: currentVideoFormat?.qualityLabel,
                    resolution: currentVideoFormat?.width && currentVideoFormat?.height ? `${currentVideoFormat.width}x${currentVideoFormat.height}` : null,
                    width: currentVideoFormat?.width,
                    height: currentVideoFormat?.height,
                    fps: currentVideoFormat?.fps,
                    bitrate: currentVideoFormat?.bitrate,
                    itag: currentVideoFormat?.itag,
                    mimeType: currentVideoFormat?.mimeType,
                    audioSampleRate: currentAudioFormat?.audioSampleRate,
                    audioChannels: currentAudioFormat?.audioChannels,
                    colorInfo: currentVideoFormat?.colorInfo, // VP9/AV1の場合に存在
                    isLive: videoDetails?.isLive || false,
                    isDash: streamingData.dashManifestUrl !== undefined,
                    isMsl: streamingData.hlsManifestUrl !== undefined,
                };

                 // 不要なキーやnull値が多い場合は整理してもよい
                 // codecInfo = Object.fromEntries(Object.entries(codecInfo).filter(([_, v]) => v != null));

                 // console.log("[Inject] Parsed codecInfo:", codecInfo);

            } else {
                console.log("[Inject] streamingData not found in playerResponse.");
                 window.postMessage({ type: "CODEC_INFO_RESULT", payload: null, error: "streamingData not found" }, "*");
                 return;
            }

        } catch (error) {
            console.error("[Inject] Error getting codec info:", error);
            codecInfo = null; // エラー時は null を返す
             window.postMessage({ type: "CODEC_INFO_RESULT", payload: null, error: error.message }, "*");
             return; // finally を使わないのでここで抜ける
        }

        // 結果をcontent.jsに送り返す
        // console.log("[Inject] Sending CODEC_INFO_RESULT with payload:", codecInfo);
        window.postMessage({ type: "CODEC_INFO_RESULT", payload: codecInfo }, "*");

    }, false); // useCapture = false

} // end of listener attachment check