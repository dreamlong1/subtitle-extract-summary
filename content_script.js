function isContextInvalidatedError(errLike) {
    const message = typeof errLike === 'string' ? errLike : errLike?.message;
    return typeof message === 'string' && message.includes('Extension context invalidated');
}

function safeSendMessage(message) {
    try {
        chrome.runtime.sendMessage(message);
    } catch (error) {
        if (!isContextInvalidatedError(error)) {
            console.error('[Content Script] sendMessage 异常:', error);
        }
    }
}

// 注入 inject.js
try {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('inject.js');
    s.onload = function () {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(s);
} catch (error) {
    if (!isContextInvalidatedError(error)) {
        console.error('[Content Script] 注入脚本失败:', error);
    }
}

// 同步调试设置
function updateDebugMode() {
    try {
        chrome.storage.local.get(['debugMode'], (result) => {
            if (chrome.runtime.lastError) {
                if (!isContextInvalidatedError(chrome.runtime.lastError.message)) {
                    console.warn('[Content Script] 读取 debugMode 失败:', chrome.runtime.lastError.message);
                }
                return;
            }

            window.postMessage({
                type: 'subtitle-extractor-set-debug',
                value: result.debugMode || false
            }, '*');
        });
    } catch (error) {
        if (!isContextInvalidatedError(error)) {
            console.error('[Content Script] updateDebugMode 异常:', error);
        }
    }
}
// 初始同步
updateDebugMode();
// 监听变化
try {
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.debugMode) {
            updateDebugMode();
        }
    });
} catch (error) {
    if (!isContextInvalidatedError(error)) {
        console.error('[Content Script] 监听 storage 变化失败:', error);
    }
}

// 监听来自 inject.js 的消息
window.addEventListener('message', function (event) {
    if (event.source !== window || !event.data || event.data.source !== 'subtitle-extractor-inject') {
        return;
    }

    if (event.data.type === 'subtitle-response') {
        // 发送到 background/popup
        safeSendMessage({
            type: 'subtitle-found',
            data: event.data.data,
            url: event.data.url,
            lang: event.data.lang,
            title: document.title || document.querySelector('meta[property="og:title"]')?.content || "Unknown Video"
        });
        console.log('字幕提取器: 发现字幕来自 ' + event.data.url);
    }
});
