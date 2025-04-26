// inject.js (Release v2)

if (window.codecInfoInjectListenerAttached) {
    // Listener already attached. Skipping setup.
} else {
    window.codecInfoInjectListenerAttached = true;
    // console.log("[Inject] Script running. Setting up listener."); // Log commented out

    window.addEventListener("message", (event) => {
        if (event.source !== window || !event.data || event.data.type !== "GET_CODEC_INFO") {
            return;
        }

        // console.log("[Inject] Received GET_CODEC_INFO request."); // Log commented out

        let codecInfo = null;
        const player = document.getElementById('movie_player');

        try {
            if (!player) {
                console.warn("[Inject] Movie player element (#movie_player) not found.");
                window.postMessage({ type: "CODEC_INFO_RESULT", payload: null, error: "Player element not found" }, "*");
                return;
            }

            let playerResponse = null;
            if (typeof player.getPlayerResponse === 'function') {
                playerResponse = player.getPlayerResponse();
            } else {
                // console.log("[Inject] player.getPlayerResponse() not available."); // Log commented out
            }

            if (!playerResponse && window.ytplayer && window.ytplayer.config && window.ytplayer.config.args && window.ytplayer.config.args.player_response) {
                // console.log("[Inject] Trying ytplayer.config.args.player_response as fallback."); // Log commented out
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
                 if (typeof player.getVideoStats === 'function') {
                     // const stats = player.getVideoStats(); // Debug only
                     // console.log("[Inject] Debug: player.getVideoStats() result:", stats);
                 }
                 window.postMessage({ type: "CODEC_INFO_RESULT", payload: null, error: "Could not retrieve playerResponse" }, "*");
                 return;
            }

            if (playerResponse && playerResponse.streamingData) {
                const videoDetails = playerResponse.videoDetails;
                const streamingData = playerResponse.streamingData;
                const adaptiveFormats = streamingData.adaptiveFormats || [];
                const formats = streamingData.formats || [];
                const allFormats = [...adaptiveFormats, ...formats];

                if (allFormats.length === 0) {
                     console.warn("[Inject] No formats found in streamingData.");
                     window.postMessage({ type: "CODEC_INFO_RESULT", payload: null, error: "No formats found" }, "*");
                     return;
                }

                let currentVideoFormat = null;
                let currentAudioFormat = null;
                let currentQualityLabel = null;
                let currentHeight = null;
                let currentItag = null;

                if (typeof player.getPlaybackQuality === 'function') {
                    currentQualityLabel = player.getPlaybackQuality();
                }
                 if (typeof player.getVideoHeight === 'function') {
                    currentHeight = player.getVideoHeight();
                 }
                 if (typeof player.getVideoData === 'function') {
                    const videoData = player.getVideoData();
                    currentItag = videoData?.itag;
                 }

                if (currentItag) {
                    currentVideoFormat = allFormats.find(f => f.itag === currentItag && f.mimeType?.startsWith('video/'));
                }

                if (!currentVideoFormat) {
                    currentVideoFormat = adaptiveFormats.find(f => f.qualityLabel === currentQualityLabel && f.mimeType?.startsWith('video/')) ||
                                        adaptiveFormats.find(f => f.height === currentHeight && f.mimeType?.startsWith('video/')) ||
                                        formats.find(f => f.qualityLabel === currentQualityLabel) ||
                                        formats.find(f => f.height === currentHeight);
                }

                if (!currentVideoFormat) {
                    currentVideoFormat = adaptiveFormats.find(f => f.mimeType?.startsWith('video/vp9')) ||
                                    adaptiveFormats.find(f => f.mimeType?.startsWith('video/av01')) ||
                                    adaptiveFormats.find(f => f.mimeType?.startsWith('video/avc1')) ||
                                    adaptiveFormats.find(f => f.mimeType?.startsWith('video/')) ||
                                    formats.find(f => f.mimeType?.startsWith('video/'));
                }

                currentAudioFormat = adaptiveFormats.find(f => f.mimeType?.startsWith('audio/opus')) ||
                                    adaptiveFormats.find(f => f.mimeType?.startsWith('audio/mp4a')) ||
                                    adaptiveFormats.find(f => f.mimeType?.startsWith('audio/'));

                if (!currentVideoFormat && !currentAudioFormat) {
                     console.warn("[Inject] Could not determine current video or audio format.");
                     window.postMessage({ type: "CODEC_INFO_RESULT", payload: null, error: "Could not determine format" }, "*");
                     return;
                }

                const videoCodecMatch = currentVideoFormat?.mimeType?.match(/codecs="([^,"]+)/);
                const audioCodecMatch = currentAudioFormat?.mimeType?.match(/codecs="([^"]+)"/);

                codecInfo = {
                    videoCodec: videoCodecMatch ? videoCodecMatch[1] : (currentVideoFormat ? 'N/A' : null),
                    audioCodec: audioCodecMatch ? audioCodecMatch[1] : (currentAudioFormat ? 'N/A' : null),
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
                    colorInfo: currentVideoFormat?.colorInfo,
                    isLive: videoDetails?.isLive || false,
                    isDash: streamingData.dashManifestUrl !== undefined,
                    isMsl: streamingData.hlsManifestUrl !== undefined,
                };

            } else {
                // console.log("[Inject] streamingData not found in playerResponse."); // Log commented out
                 window.postMessage({ type: "CODEC_INFO_RESULT", payload: null, error: "streamingData not found" }, "*");
                 return;
            }

        } catch (error) {
            console.error("[Inject] Error getting codec info:", error);
            codecInfo = null;
             window.postMessage({ type: "CODEC_INFO_RESULT", payload: null, error: error.message }, "*");
             return;
        }

        // console.log("[Inject] Sending CODEC_INFO_RESULT with payload:", codecInfo); // Log commented out
        window.postMessage({ type: "CODEC_INFO_RESULT", payload: codecInfo }, "*");

    }, false);

}