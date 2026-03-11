
(function () {
    const SUBTITLE_PATTERNS = [

        /\/api\/timedtext/, // YouTube Standard API
        /videoplayback.*expire.*mime=text/, // YouTube Video Playback (Text)
        /videoplayback.*mime=text.*expire/, // YouTube Video Playback (Text alternative)
        /youtube\.com\/.*vss/, // YouTube VSS
        /aisubtitle\.hdslb\.com\/bfs/, // Bilibili Direct
        /api\.bilibili\.com\/x\/player\/wbi\/v2/, // Bilibili Player Info (WBI)
        /api\.bilibili\.com\/x\/player\/v2/ // Bilibili Player Info (Old)
    ];

    let isDebug = false;

    const Logger = {
        log: (...args) => {
            if (isDebug) console.log(...args);
        },
        error: (...args) => {
            // 错误始终打印，或者也受控？通常错误应该打印
            console.error(...args);
        }
    };

    window.addEventListener('message', function (event) {
        if (event.source === window && event.data && event.data.type === 'subtitle-extractor-set-debug') {
            isDebug = event.data.value;
            if (isDebug) console.log('[字幕提取器] 调试模式已开启');
        }
    });

    function isSubtitleUrl(url) {
        return SUBTITLE_PATTERNS.some(pattern => pattern.test(url));
    }

    function sendToContentScript(type, data, url, lang = null) {
        if (!lang) {
            try {
                const urlObj = new URL(url.startsWith('//') ? 'https:' + url : url);
                lang = urlObj.searchParams.get('lang') || urlObj.searchParams.get('hl');
            } catch (e) { }
        }
        Logger.log(`[字幕提取器] 捕获到字幕: ${url} (${lang || 'Unknown'})`);
        window.postMessage({
            source: 'subtitle-extractor-inject',
            type: type,
            data: data,
            url: url,
            lang: lang
        }, '*');
    }

    // 处理 Bilibili Player API 响应，主动获取字幕
    function handleBilibiliPlayerResponse(response, originalUrl) {
        try {
            const json = JSON.parse(response);
            if (json && json.data && json.data.subtitle && json.data.subtitle.subtitles) {
                const subtitles = json.data.subtitle.subtitles;
                Logger.log(`[字幕提取器] 在 Player API 中发现 ${subtitles.length} 个字幕`);
                Logger.log('[字幕提取器 Debug] 字幕对象示例:', JSON.stringify(subtitles[0]));
                subtitles.forEach(sub => {
                    if (sub.subtitle_url) {
                        // 主动获取字幕内容
                        const subUrl = sub.subtitle_url.startsWith('//') ? 'https:' + sub.subtitle_url : sub.subtitle_url;
                        Logger.log(`[字幕提取器] 主动获取字幕: ${subUrl}`);
                        fetch(subUrl)
                            .then(res => res.json())
                            .then(subData => {
                                // B站字幕通常是 JSON 格式，直接发送
                                sendToContentScript('subtitle-response', JSON.stringify(subData), subUrl, sub.lan_doc);
                            })
                            .catch(err => Logger.error('[字幕提取器] 主动获取字幕失败', err));
                    }
                });
            }
        } catch (e) {
            Logger.error('[字幕提取器] 解析 Bilibili Player 响应失败', e);
        }
    }

    // 处理 YouTube Player Response，主动获取字幕
    function handleYouTubePlayerResponse(response) {
        try {
            const json = typeof response === 'string' ? JSON.parse(response) : response;
            if (!json) return;

            let captionTracks = null;
            if (json.captions && json.captions.playerCaptionsTracklistRenderer) {
                captionTracks = json.captions.playerCaptionsTracklistRenderer.captionTracks;
            }

            if (captionTracks) {
                Logger.log(`[字幕提取器] 在 YouTube Player Data 中发现 ${captionTracks.length} 个字幕`);
                captionTracks.forEach(track => {
                    if (track.baseUrl) {
                        Logger.log(`[字幕提取器] 主动获取 YouTube 字幕: ${track.name.simpleText}`);
                        fetch(track.baseUrl)
                            .then(res => res.text()) // YouTube 返回 XML
                            .then(text => {
                                sendToContentScript('subtitle-response', text, track.baseUrl, track.name.simpleText);
                            })
                            .catch(err => Logger.error('[字幕提取器] 主动获取 YouTube 字幕失败', err));
                    }
                });
            }
        } catch (e) {
            Logger.error('[字幕提取器] 解析 YouTube Player 响应失败', e);
        }
    }

    // Hook XMLHttpRequest (拦截 XMLHttpRequest)
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
        this._url = url;
        return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
        const url = this._url;
        // DEBUG: 打印所有请求，方便排查
        // Logger.log('[字幕提取器 Debug] XHR:', url); 

        if (url && isSubtitleUrl(url)) {
            Logger.log(`[字幕提取器] 检测到潜在字幕请求: ${url}`);
            this.addEventListener('load', function () {
                // 特殊处理 Bilibili Player API
                if (url.includes('api.bilibili.com/x/player')) {
                    handleBilibiliPlayerResponse(this.responseText, url);
                    return;
                }

                // 特殊处理 YouTube Player API (SPA 导航)
                if (url.includes('/youtubei/v1/player')) {
                    handleYouTubePlayerResponse(this.responseText);
                    // 继续执行，因为原始响应可能也很有用（虽然这里我们已经主动获取了所有字幕）
                }

                if (this.responseType === '' || this.responseType === 'text') {
                    sendToContentScript('subtitle-response', this.responseText, url);
                } else if (this.responseType === 'json') {
                    sendToContentScript('subtitle-response', JSON.stringify(this.response), url);
                } else if (this.responseType === 'arraybuffer') {
                    try {
                        const decoder = new TextDecoder("utf-8");
                        const text = decoder.decode(this.response);
                        sendToContentScript('subtitle-response', text, url);
                    } catch (e) {
                        Logger.error('[字幕提取器]无法解码 ArrayBuffer 字幕', e);
                    }
                }
            });
        }
        return originalSend.apply(this, arguments);
    };

    // Hook Fetch (拦截 Fetch)
    const originalFetch = window.fetch;
    window.fetch = async function (input, init) {
        const response = await originalFetch.apply(this, arguments);
        const url = typeof input === 'string' ? input : input.url;

        // DEBUG: 打印所有请求，方便排查
        // Logger.log('[字幕提取器 Debug] Fetch:', url);

        if (url && isSubtitleUrl(url)) {
            Logger.log(`[字幕提取器] 检测到潜在字幕 Fetch: ${url}`);
            const clone = response.clone();
            clone.text().then(text => {
                sendToContentScript('subtitle-response', text, url);
            }).catch(err => Logger.error('[字幕提取器] 读取字幕响应失败', err));
        }

        return response;
    };

    Logger.log('[字幕提取器] 网络请求拦截器已激活。');

    // YouTube 初始加载处理 (Global Variable)
    if (window.location.hostname.includes('youtube.com')) {
        const checkYT = setInterval(() => {
            if (window.ytInitialPlayerResponse) {
                Logger.log('[字幕提取器] 检测到 YouTube 初始数据');
                handleYouTubePlayerResponse(window.ytInitialPlayerResponse);
                clearInterval(checkYT);
            }
        }, 1000);

        // 10秒后停止轮询，防止无休止
        setTimeout(() => clearInterval(checkYT), 10000);
    }
})();
