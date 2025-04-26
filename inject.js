// inject.js (修正版 v2.2 - Improved Audio Estimation & Debug)

if (window.codecInfoInjectListenerAttached) {
    // Listener already attached. Skipping setup.
} else {
    window.codecInfoInjectListenerAttached = true;
    console.log("[Inject] Script running (v2.2). Setting up listener."); // Version updated

    window.addEventListener("message", (event) => {
        if (event.source !== window || !event.data || event.data.type !== "GET_CODEC_INFO") {
            return;
        }

        console.log("[Inject] Received GET_CODEC_INFO request."); // Debug log re-enabled

        let codecInfo = null;
        const player = document.getElementById('movie_player');

        try {
            if (!player) {
                console.warn("[Inject] Movie player element (#movie_player) not found.");
                window.postMessage({ type: "CODEC_INFO_RESULT", payload: null, error: "Player element not found" }, "*");
                return;
            }

            // --- Player Response Acquisition (Same as v2.1) ---
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
            // --- End Player Response Acquisition ---

            if (!playerResponse) {
                 console.warn("[Inject] Could not retrieve playerResponse data.");
                 window.postMessage({ type: "CODEC_INFO_RESULT", payload: null, error: "Could not retrieve playerResponse" }, "*");
                 return;
            }

            // --- Format Parsing and Estimation ---
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

                // --- Get Current Playback State (Same as v2.1) ---
                let currentQualityLabel = null;
                let currentHeight = null;
                let currentItag = null;
                if (typeof player.getPlaybackQuality === 'function') { currentQualityLabel = player.getPlaybackQuality(); }
                if (typeof player.getVideoHeight === 'function') { currentHeight = player.getVideoHeight(); }
                if (typeof player.getVideoData === 'function') {
                    const videoData = player.getVideoData();
                    currentItag = videoData?.itag;
                    if (currentHeight === 0 && videoData?.height) { currentHeight = videoData.height; }
                }
                // console.log("[Inject] Current playback state:", { currentItag, currentQualityLabel, currentHeight });
                // --- End Playback State ---


                // --- Video Format Estimation (Same as v2.1) ---
                let currentVideoFormat = null;
                if (currentItag) { /* Find by itag */ currentVideoFormat = allFormats.find(f => f.itag === currentItag && f.mimeType?.startsWith('video/')); }
                if (!currentVideoFormat && (currentHeight || currentQualityLabel)) { /* Estimate by height/quality */
                    const potentialMatches = adaptiveFormats.filter(f => f.mimeType?.startsWith('video/') && ((currentHeight && f.height === currentHeight) || (currentQualityLabel && f.qualityLabel === currentQualityLabel)));
                    if (potentialMatches.length > 0) { currentVideoFormat = potentialMatches.find(f => f.mimeType?.includes('av01')) || potentialMatches.find(f => f.mimeType?.includes('vp09')) || potentialMatches.find(f => f.mimeType?.includes('avc1')) || potentialMatches[0]; }
                    else { const potentialRegularMatches = formats.filter(f => f.mimeType?.startsWith('video/') && ((currentHeight && f.height === currentHeight) || (currentQualityLabel && f.qualityLabel === currentQualityLabel))); if (potentialRegularMatches.length > 0) { currentVideoFormat = potentialRegularMatches.find(f => f.mimeType?.includes('av01')) || potentialRegularMatches.find(f => f.mimeType?.includes('vp09')) || potentialRegularMatches.find(f => f.mimeType?.includes('avc1')) || potentialRegularMatches[0]; } }
                }
                if (!currentVideoFormat) { /* Fallback */ currentVideoFormat = adaptiveFormats.find(f => f.mimeType?.includes('av01')) || adaptiveFormats.find(f => f.mimeType?.includes('vp09')) || adaptiveFormats.find(f => f.mimeType?.includes('avc1')) || formats.find(f => f.mimeType?.includes('av01')) || formats.find(f => f.mimeType?.includes('vp09')) || formats.find(f => f.mimeType?.includes('avc1')) || adaptiveFormats.find(f => f.mimeType?.startsWith('video/')) || formats.find(f => f.mimeType?.startsWith('video/')); }
                // --- End Video Estimation ---


                // ★★★ Audio Format Estimation (Revised with Bitrate Priority & Debugging) ★★★
                let currentAudioFormat = null;
                const allAudioFormats = allFormats.filter(f => f.mimeType?.startsWith('audio/'));
                console.log(`[Inject] Found ${allAudioFormats.length} total audio formats.`); // Debug log

                if (allAudioFormats.length > 0) {
                    // Strategy: Prefer Opus, then AAC. Within each, prefer higher bitrate.

                    const opusFormats = allAudioFormats.filter(f => f.mimeType?.includes('opus'));
                    const aacFormats = allAudioFormats.filter(f => f.mimeType?.includes('mp4a')); // Typically AAC
                    const otherAudioFormats = allAudioFormats.filter(f => !f.mimeType?.includes('opus') && !f.mimeType?.includes('mp4a'));

                    console.log(`[Inject] Audio formats breakdown: Opus(${opusFormats.length}), AAC(${aacFormats.length}), Other(${otherAudioFormats.length})`); // Debug log
                    if (opusFormats.length > 0) opusFormats.forEach(f => console.log(` - Opus Candidate: itag=${f.itag}, bitrate=${f.bitrate}, quality=${f.audioQuality}`)); // Debug log
                    if (aacFormats.length > 0) aacFormats.forEach(f => console.log(` - AAC Candidate: itag=${f.itag}, bitrate=${f.bitrate}, quality=${f.audioQuality}`));   // Debug log

                    // Find the best Opus format (highest bitrate)
                    let bestOpus = null;
                    if (opusFormats.length > 0) {
                        opusFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
                        bestOpus = opusFormats[0];
                    }

                    // Find the best AAC format (highest bitrate)
                    let bestAac = null;
                    if (aacFormats.length > 0) {
                        aacFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
                        bestAac = aacFormats[0];
                    }

                    // Find the best Other format (highest bitrate)
                    let bestOther = null;
                     if (otherAudioFormats.length > 0) {
                         otherAudioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
                         bestOther = otherAudioFormats[0];
                     }

                    // Prioritize: Best Opus > Best AAC > Best Other
                    if (bestOpus) {
                        currentAudioFormat = bestOpus;
                        console.log("[Inject] Selected best Opus format:", currentAudioFormat); // Debug log
                    } else if (bestAac) {
                        currentAudioFormat = bestAac;
                        console.log("[Inject] Selected best AAC format:", currentAudioFormat); // Debug log
                    } else if (bestOther){
                        currentAudioFormat = bestOther;
                        console.log("[Inject] Selected best 'Other' audio format:", currentAudioFormat); // Debug log
                    }
                } else {
                    console.warn("[Inject] No audio formats found in adaptive/regular lists.");
                }
                // --- End Audio Estimation ---


                if (!currentVideoFormat && !currentAudioFormat) {
                     console.warn("[Inject] Could not determine any current video or audio format.");
                     window.postMessage({ type: "CODEC_INFO_RESULT", payload: null, error: "Could not determine format" }, "*");
                     return;
                }

                // --- Extract Info (Same as before) ---
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
                    bitrate: currentVideoFormat?.bitrate, // Video bitrate
                    audioBitrate: currentAudioFormat?.bitrate, // Audio bitrate (add if needed)
                    itag: currentVideoFormat?.itag, // Video itag
                    audioItag: currentAudioFormat?.itag, // Audio itag (add if needed)
                    mimeType: currentVideoFormat?.mimeType,
                    audioMimeType: currentAudioFormat?.mimeType, // Audio mimeType (add if needed)
                    audioSampleRate: currentAudioFormat?.audioSampleRate,
                    audioChannels: currentAudioFormat?.audioChannels,
                    colorInfo: currentVideoFormat?.colorInfo,
                    isLive: videoDetails?.isLive || false,
                    isDash: streamingData.dashManifestUrl !== undefined,
                    isMsl: streamingData.hlsManifestUrl !== undefined,
                };
                // --- End Extract Info ---

                 console.log("[Inject] Final determined codecInfo (Audio logic improved):", codecInfo); // Debug log

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

} // end of listener attachment check