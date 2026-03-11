/**
 * Chrome API Promise 封装模块
 * 将 Chrome 扩展的回调式 API 封装为 Promise，支持 async/await
 */

const ChromeAPI = {
    /**
     * 获取当前激活的标签页
     * @returns {Promise<chrome.tabs.Tab>}
     */
    getCurrentTab: () => {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (tabs && tabs.length > 0) {
                    resolve(tabs[0]);
                } else {
                    reject(new Error('No active tab found'));
                }
            });
        });
    },

    /**
     * 从本地存储获取数据
     * @param {string|string[]|object} keys - 要获取的键
     * @returns {Promise<object>}
     */
    storageGet: (keys) => {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(result);
                }
            });
        });
    },

    /**
     * 向本地存储写入数据
     * @param {object} items - 要存储的键值对
     * @returns {Promise<void>}
     */
    storageSet: (items) => {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set(items, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });
    },

    /**
     * 从本地存储删除数据
     * @param {string|string[]} keys - 要删除的键
     * @returns {Promise<void>}
     */
    storageRemove: (keys) => {
        return new Promise((resolve, reject) => {
            chrome.storage.local.remove(keys, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });
    },

    /**
     * 发送消息到 background script
     * @param {object} message - 消息对象
     * @returns {Promise<any>}
     */
    sendMessage: (message) => {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    },

    /**
     * 向指定标签页发送消息
     * @param {number} tabId - 标签页 ID
     * @param {object} message - 消息对象
     * @returns {Promise<any>}
     */
    sendTabMessage: (tabId, message) => {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    },

    /**
     * 设置扩展图标的 Badge 文本
     * @param {number} tabId - 标签页 ID
     * @param {string} text - Badge 文本
     * @returns {Promise<void>}
     */
    setBadgeText: (tabId, text) => {
        return new Promise((resolve) => {
            chrome.action.setBadgeText({ tabId, text }, resolve);
        });
    },

    /**
     * 打开扩展设置页面
     */
    openOptionsPage: () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options/options.html'));
        }
    }
};

// 导出（如果在模块环境中使用）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChromeAPI;
}
