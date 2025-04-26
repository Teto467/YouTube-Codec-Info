// inject.js (Release v2.1 - AV1 Priority)

if (window.codecInfoInjectListenerAttached) {
    // Listener already attached. Skipping setup.
} else {
    window.codecInfoInjectListenerAttached = true;
    // console.log("[Inject] Script running (v2.1). Setting up listener.");

    window.addEventListener("message", (event) => {
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

            let playerResponse = null;
            if (typeof player.getPlayerResponse === 'function') {
                playerResponse = player.getPlayerResponse();
                // console.log("[Inject] player.getPlayerResponse() available.");
            } else {
                 // console.log("[Inject] player.getPlayerResponse() not available.");
            }
            if (!playerResponse && window.ytplayer && window.ytplayer.config && window.ytplayer.config.args && window.ytplayer.config.args.player_response) {
                // console.log("[Inject] Trying ytplayer.config.args.player_response as fallback.");
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
                 window.postMessage({ type: "CODEC_INFO_RESULT", payload: null, error: "Could not retrieve playerResponse" }, "*");
                 return;
            }

            if (playerResponse && playerResponse.streamingData) {
                // console.log("[Inject] Parsing playerResponse.streamingData...");
                const videoDetails = playerResponse.videoDetails;
                const streamingData = playerResponse.streamingData;
                const adaptiveFormats = streamingData.adaptiveFormats || [];
                const formats = streamingData.formats || [];
                const allFormats = [...adaptiveFormats, ...formats];
                // console.log(`[Inject] Found ${adaptiveFormats.length} adaptive formats and ${formats.length} regular formats.`);

                if (allFormats.length === 0) {
                     console.warn("[Inject] No formats found in streamingData.");
                     window.postMessage({ type: "CODEC_INFO_RESULT", payload: null, error: "No formats found" }, "*");
                     return;
                }

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
                    if (currentHeight === 0 && videoData?.height) {
                        currentHeight = videoData.height;
                    }
                 }
                // console.log("[Inject] Current playback state:", { currentItag, currentQualityLabel, currentHeight });


                let currentVideoFormat = null;
                let currentAudioFormat = null;

                if (currentItag) {
                    // console.log(`[Inject] Attempting to find video format by itag: ${currentItag}`);
                    currentVideoFormat = allFormats.find(f => f.itag === currentItag && f.mimeType?.startsWith('video/'));
                    // if (currentVideoFormat) console.log("[Inject] Found video format by ITAG:", currentVideoFormat);
                    // else console.log("[Inject] Video format not found by ITAG. Proceeding to estimation.");
                }

                if (!currentVideoFormat && (currentHeight || currentQualityLabel)) {
                    // console.log("[Inject] Estimating video format by height/qualityLabel...");
                    const potentialMatches = adaptiveFormats.filter(f =>
                        f.mimeType?.startsWith('video/') &&
                        ((currentHeight && f.height === currentHeight) || (currentQualityLabel && f.qualityLabel === currentQualityLabel))
                    );
                    // console.log(`[Inject] Found ${potentialMatches.length} potential matches based on height/quality.`);

                    if (potentialMatches.length > 0) {
                        currentVideoFormat =
                            potentialMatches.find(f => f.mimeType?.includes('av01')) ||
                            potentialMatches.find(f => f.mimeType?.includes('vp09')) ||
                            potentialMatches.find(f => f.mimeType?.includes('avc1')) ||
                            potentialMatches[0];
                         // console.log("[Inject] Estimated video format from potential matches:", currentVideoFormat);
                    } else {
                        // console.log("[Inject] No potential matches found by height/quality in adaptive formats.");
                         const potentialRegularMatches = formats.filter(f =>
                             f.mimeType?.startsWith('video/') &&
                             ((currentHeight && f.height === currentHeight) || (currentQualityLabel && f.qualityLabel === currentQualityLabel))
                         );
                          if (potentialRegularMatches.length > 0) {
                              currentVideoFormat =
                                  potentialRegularMatches.find(f => f.mimeType?.includes('av01')) ||
                                  potentialRegularMatches.find(f => f.mimeType?.includes('vp09')) ||
                                  potentialRegularMatches.find(f => f.mimeType?.includes('avc1')) ||
                                  potentialRegularMatches[0];
                              // console.log("[Inject] Estimated video format from potential regular matches:", currentVideoFormat);
                          }
                    }
                }

                if (!currentVideoFormat) {
                    // console.log("[Inject] Fallback: Finding best available video format...");
                    currentVideoFormat =
                        adaptiveFormats.find(f => f.mimeType?.includes('av01')) ||
                        adaptiveFormats.find(f => f.mimeType?.includes('vp09')) ||
                        adaptiveFormats.find(f => f.mimeType?.includes('avc1')) ||
                        formats.find(f => f.mimeType?.includes('av01')) ||
                        formats.find(f => f.mimeType?.includes('vp09')) ||
                        formats.find(f => f.mimeType?.includes('avc1')) ||
                        adaptiveFormats.find(f => f.mimeType?.startsWith('video/')) ||
                        formats.find(f => f.mimeType?.startsWith('video/'));
                    // if (currentVideoFormat) console.log("[Inject] Found video format via fallback:", currentVideoFormat);
                }

                currentAudioFormat = adaptiveFormats.find(f => f.mimeType?.startsWith('audio/opus')) ||
                                    adaptiveFormats.find(f => f.mimeType?.startsWith('audio/mp4a')) ||
                                    adaptiveFormats.find(f => f.mimeType?.startsWith('audio/')) ||
                                    formats.find(f => f.mimeType?.startsWith('audio/'));

                if (!currentVideoFormat && !currentAudioFormat) {
                     console.warn("[Inject] Could not determine any current video or audio format.");
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
                 // console.log("[Inject] Final determined codecInfo:", codecInfo);

            } else {
                console.warn("[Inject] streamingData not found in playerResponse.");
                 window.postMessage({ type: "CODEC_INFO_RESULT", payload: null, error: "streamingData not found" }, "*");
                 return;
            }

        } catch (error) {
            console.error("[Inject] Error getting codec info:", error);
            codecInfo = null;
             window.postMessage({ type: "CODEC_INFO_RESULT", payload: null, error: error.message }, "*");
             return;
        }

        window.postMessage({ type: "CODEC_INFO_RESULT", payload: codecInfo }, "*");

    }, false);
}