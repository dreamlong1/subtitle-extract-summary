document.addEventListener('DOMContentLoaded', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (!currentTab || !Number.isInteger(currentTab.id)) {
            return;
        }

        const key = `subtitles_${currentTab.id}`;
        loadSubtitlesForTab(currentTab.id, key, async (subtitles) => {
            const mainInterface = document.getElementById('main-interface');
            const statusHeader = document.getElementById('status-header');
            const downloadBtn = document.getElementById('download-btn');
            const summarizeBtn = document.getElementById('summarize-btn');
            const settingsBtn = document.getElementById('settings-btn');

            const selectWrapper = document.querySelector('.custom-select');
            const selectTrigger = document.querySelector('.custom-select__trigger');
            const selectTriggerSpan = selectTrigger.querySelector('span');
            const optionsContainer = document.querySelector('.custom-options');

            const summaryArea = document.getElementById('summary-area');
            const summaryStatus = document.getElementById('summary-status');
            const summaryResult = document.getElementById('summary-result');
            const summaryText = document.getElementById('summary-text');
            const summaryError = document.getElementById('summary-error');

            const statusStep1 = document.getElementById('status-step-1');
            const statusStep2 = document.getElementById('status-step-2');
            const statusStep3 = document.getElementById('status-step-3');

            let selectedIndex = 0;
            let isSummaryRunning = false;
            let cachedSummaryState = await getSummaryState(currentTab.id);

            settingsBtn.onclick = () => {
                if (chrome.runtime.openOptionsPage) {
                    chrome.runtime.openOptionsPage();
                } else {
                    window.open(chrome.runtime.getURL('options/options.html'));
                }
            };

            function setSuccessHeader(text) {
                statusHeader.innerHTML = `
                    <div class="status-success">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        ${text}
                    </div>
                `;
            }

            function setWaitingHeader(text) {
                statusHeader.textContent = text;
                statusHeader.className = 'status-header status-waiting';
            }

            function updateStep(stepEl, status, text) {
                const icon = stepEl.querySelector('.step-icon');
                const span = stepEl.querySelector('span:last-child');
                if (text) span.textContent = text;

                if (status === 'active') {
                    stepEl.style.color = '#007aff';
                    icon.textContent = '◉';
                } else if (status === 'done') {
                    stepEl.style.color = '#2e7d32';
                    icon.textContent = '✓';
                } else if (status === 'error') {
                    stepEl.style.color = '#c62828';
                    icon.textContent = '✗';
                } else {
                    stepEl.style.color = '#ccc';
                    icon.textContent = '○';
                }
            }

            function resetSteps() {
                updateStep(statusStep1, 'pending', '发送请求中...');
                updateStep(statusStep2, 'pending', '等待响应...');
                updateStep(statusStep3, 'pending', '输出内容...');
            }

            function getSubtitleDisplay(sub) {
                let langDisplay = sub.lang || 'Unknown';
                if (sub.url.includes('api/timedtext')) {
                    langDisplay += ' (YouTube)';
                } else if (sub.url.includes('bilibili') || sub.url.includes('hdslb.com')) {
                    langDisplay += ' (Bilibili)';
                }
                return langDisplay;
            }

            function normalizeSubtitleUrl(url) {
                if (!url) return '';
                return url.startsWith('//') ? `https:${url}` : url;
            }

            function setSelectedIndex(nextIndex) {
                selectedIndex = nextIndex;
                Array.from(optionsContainer.children).forEach((child, index) => {
                    child.classList.toggle('selected', index === selectedIndex);
                });
                if (optionsContainer.children[selectedIndex]) {
                    selectTriggerSpan.textContent = optionsContainer.children[selectedIndex].textContent;
                }
            }

            function showSummaryContent(content) {
                summaryArea.style.display = 'block';
                summaryStatus.style.display = 'none';
                summaryResult.style.display = 'block';
                summaryText.innerHTML = markdownToHtml(content || '');
                summaryText.scrollTop = 0;
            }

            function showSummaryError(message) {
                summaryArea.style.display = 'block';
                summaryError.textContent = `错误: ${message}`;
                summaryError.style.display = 'block';
            }

            function renderCachedSummary(summaryState) {
                if (!summaryState) return;

                summaryArea.style.display = 'block';
                summaryError.style.display = 'none';
                summaryStatus.style.display = 'none';
                summaryResult.style.display = 'none';

                if (summaryState.content) {
                    showSummaryContent(summaryState.content);
                }

                if (summaryState.status === 'done' && summaryState.content) {
                    setSuccessHeader('总结成功');
                } else if (summaryState.status === 'streaming') {
                    if (!summaryState.content) {
                        summaryStatus.style.display = 'block';
                        resetSteps();
                        updateStep(statusStep1, 'done', '请求已发送');
                        updateStep(statusStep2, 'done', '收到响应');
                        updateStep(statusStep3, 'active', '输出中...');
                    }
                } else if (summaryState.status === 'error') {
                    if (summaryState.content) {
                        setSuccessHeader('已恢复上次总结');
                    }
                    if (summaryState.error) {
                        showSummaryError(summaryState.error);
                    }
                }
            }

            function syncSummaryView() {
                const hasReusableSummary = cachedSummaryState
                    && (cachedSummaryState.status === 'streaming' || Boolean(cachedSummaryState.content));

                if (hasReusableSummary) {
                    renderCachedSummary(cachedSummaryState);
                    return;
                }

                summaryArea.style.display = 'none';
                summaryStatus.style.display = 'none';
                summaryResult.style.display = 'none';
                summaryError.style.display = 'none';
                if (!isSummaryRunning) {
                    setSuccessHeader('检测成功');
                }
            }

            async function resolveActiveProviderConfig(openSettingsOnMissing) {
                return new Promise((resolve) => {
                    chrome.storage.local.get(['aiProviders', 'activeProviderId', 'aiConfig'], (res) => {
                        let activeConfig = null;

                        if (res.aiProviders && res.activeProviderId) {
                            activeConfig = res.aiProviders.find((provider) => provider.id === res.activeProviderId);
                        }

                        if (!activeConfig && res.aiConfig && res.aiConfig.key) {
                            activeConfig = res.aiConfig;
                        }

                        if ((!activeConfig || !activeConfig.key) && openSettingsOnMissing) {
                            if (chrome.runtime.openOptionsPage) {
                                chrome.runtime.openOptionsPage();
                            } else {
                                window.open(chrome.runtime.getURL('options/options.html'));
                            }
                        }

                        resolve(activeConfig);
                    });
                });
            }

            async function startSummary(options = {}) {
                const { openSettingsOnMissing = false } = options;
                if (isSummaryRunning || subtitles.length === 0) {
                    return;
                }

                const activeConfig = await resolveActiveProviderConfig(openSettingsOnMissing);
                if (!activeConfig || !activeConfig.key) {
                    return;
                }

                const selectedSub = subtitles[selectedIndex];
                if (!selectedSub) {
                    return;
                }

                isSummaryRunning = true;
                summaryArea.style.display = 'block';
                summaryStatus.style.display = 'block';
                summaryResult.style.display = 'none';
                summaryError.style.display = 'none';
                resetSteps();
                updateStep(statusStep1, 'active', '发送请求中...');

                const sub = await ensureSubtitleData(selectedSub, currentTab.id);
                if (!sub.data) {
                    updateStep(statusStep1, 'error', '字幕获取失败');
                    updateStep(statusStep2, 'error', '请求失败');
                    showSummaryError('无法获取字幕内容，请刷新页面后重试');
                    isSummaryRunning = false;
                    return;
                }

                const plainText = extractSubtitleText(sub.data, sub.url);
                if (!plainText.trim()) {
                    updateStep(statusStep1, 'error', '字幕内容为空');
                    updateStep(statusStep2, 'error', '请求失败');
                    showSummaryError('字幕解析后为空，无法总结');
                    isSummaryRunning = false;
                    return;
                }

                const port = chrome.runtime.connect({ name: 'summarize-stream' });
                let streamedContent = '';
                let hasScrolledToBottom = false;
                let finished = false;

                port.onMessage.addListener((msg) => {
                    if (msg.type === 'chunk') {
                        if (streamedContent === '') {
                            updateStep(statusStep1, 'done', '请求已发送');
                            updateStep(statusStep2, 'done', '收到响应');
                            updateStep(statusStep3, 'active', '输出中...');
                            summaryStatus.style.display = 'none';
                            summaryResult.style.display = 'block';
                            summaryError.style.display = 'none';
                            summaryText.innerHTML = '';
                            summaryText.scrollTop = 0;
                        }

                        streamedContent += msg.content;
                        summaryText.innerHTML = markdownToHtml(streamedContent);

                        if (!hasScrolledToBottom && summaryText.scrollHeight >= 450) {
                            hasScrolledToBottom = true;
                            setTimeout(() => {
                                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                            }, 50);
                        }
                    } else if (msg.type === 'done') {
                        finished = true;
                        isSummaryRunning = false;
                        updateStep(statusStep3, 'done', '输出完成');
                        summaryStatus.style.display = 'none';
                        summaryResult.style.display = 'block';
                        setSuccessHeader('总结成功');
                        cachedSummaryState = {
                            status: 'done',
                            content: streamedContent,
                            error: '',
                            subtitleUrl: sub.url,
                            providerId: activeConfig.id || '',
                            title: sub.title || '',
                            lang: sub.lang || ''
                        };
                        port.disconnect();
                    } else if (msg.type === 'error') {
                        finished = true;
                        isSummaryRunning = false;
                        updateStep(statusStep1, 'done', '请求已发送');
                        updateStep(statusStep2, 'error', '请求失败');
                        if (streamedContent) {
                            showSummaryContent(streamedContent);
                        }
                        showSummaryError(msg.error);
                        cachedSummaryState = {
                            status: 'error',
                            content: streamedContent,
                            error: msg.error,
                            subtitleUrl: sub.url,
                            providerId: activeConfig.id || '',
                            title: sub.title || '',
                            lang: sub.lang || ''
                        };
                        port.disconnect();
                    }
                });

                port.onDisconnect.addListener(() => {
                    if (!finished) {
                        isSummaryRunning = false;
                    }
                });

                port.postMessage({
                    action: 'start',
                    tabId: currentTab.id,
                    subtitleUrl: sub.url,
                    subtitle: plainText,
                    lang: sub.lang,
                    title: sub.title,
                    config: activeConfig
                });
            }

            if (subtitles.length === 0) {
                setWaitingHeader('暂未检测到字幕...');
                mainInterface.style.display = 'none';
                return;
            }

            console.log('[Popup] 加载字幕:', JSON.stringify(subtitles));
            setSuccessHeader('检测成功');
            mainInterface.style.display = 'block';

            subtitles.sort((a, b) => {
                const getScore = (item) => {
                    const lang = (item.lang || '').toLowerCase();
                    if (lang.includes('中文') || lang.includes('zh') || lang.includes('chinese')) return 3;
                    if (lang.includes('english') || lang.includes('en')) return 2;
                    return 1;
                };
                return getScore(b) - getScore(a);
            });

            if (cachedSummaryState && cachedSummaryState.subtitleUrl) {
                const normalizedCachedUrl = normalizeSubtitleUrl(cachedSummaryState.subtitleUrl);
                const cachedIndex = subtitles.findIndex((sub) => normalizeSubtitleUrl(sub.url) === normalizedCachedUrl);
                if (cachedIndex !== -1) {
                    selectedIndex = cachedIndex;
                }
            }

            optionsContainer.innerHTML = '';
            subtitles.forEach((sub, index) => {
                const option = document.createElement('div');
                option.className = 'custom-option';
                if (index === selectedIndex) {
                    option.classList.add('selected');
                }

                option.textContent = getSubtitleDisplay(sub);
                option.dataset.value = index;

                option.addEventListener('click', () => {
                    setSelectedIndex(index);
                    selectWrapper.classList.remove('open');
                    syncSummaryView();
                });

                optionsContainer.appendChild(option);
            });

            setSelectedIndex(selectedIndex);

            selectTrigger.addEventListener('click', () => {
                selectWrapper.classList.toggle('open');
            });

            document.addEventListener('click', (event) => {
                if (!selectWrapper.contains(event.target)) {
                    selectWrapper.classList.remove('open');
                }
            });

            downloadBtn.onclick = async () => {
                const selectedSub = subtitles[selectedIndex];
                const subWithData = await ensureSubtitleData(selectedSub, currentTab.id);
                if (!subWithData.data) {
                    alert('无法获取字幕内容，请刷新页面后重试');
                    return;
                }
                downloadSubtitle(subWithData, selectedIndex);
            };

            summarizeBtn.onclick = async () => {
                await startSummary({ openSettingsOnMissing: true });
            };

            syncSummaryView();

            const hasReusableSummary = cachedSummaryState
                && (cachedSummaryState.status === 'streaming' || Boolean(cachedSummaryState.content));
            const shouldAutoStart = !hasReusableSummary;

            if (shouldAutoStart) {
                await startSummary({ openSettingsOnMissing: false });
            }
        });
    });
});

function downloadSubtitle(sub, index) {
    let content = typeof sub.data === 'string' ? sub.data : '';
    if (!content) {
        console.warn('[Popup] 字幕内容为空，取消下载');
        return;
    }
    let ext = 'txt';
    let mime = 'text/plain';

    // 简单的格式检测
    if (sub.url.includes('api/timedtext')) {
        ext = 'xml'; // YouTube 通常是 XML
        if (content.startsWith('{')) {
            ext = 'json'; // 或者是 JSON
            mime = 'application/json';
        } else {
            mime = 'text/xml';
        }
    } else if (sub.url.includes('aisubtitle.hdslb.com')) {
        ext = 'json'; // Bilibili 通常是 JSON
        mime = 'application/json';
    } else {
        // Default check
        if (content.startsWith('{')) {
            ext = 'json';
            mime = 'application/json';
        }
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Clean filename
    const safeTitle = (sub.title || 'subtitle').replace(/[<>:"/\\|?*]+/g, '_').trim();
    const langSuffix = sub.lang ? `_${sub.lang}` : `_${index + 1}`;
    a.download = `${safeTitle}${langSuffix}.${ext}`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
        try {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                resolve(response);
            });
        } catch (error) {
            reject(error);
        }
    });
}

async function getSummaryState(tabId) {
    try {
        const response = await sendRuntimeMessage({ action: 'get-summary-state', tabId });
        return response && response.summary ? response.summary : null;
    } catch (error) {
        console.warn('[Popup] 获取总结缓存失败:', error.message);
        return null;
    }
}

function loadSubtitlesForTab(tabId, storageKey, callback) {
    sendRuntimeMessage({ action: 'get-subtitles', tabId })
        .then((response) => {
            if (response && Array.isArray(response.subtitles)) {
                callback(response.subtitles);
                return;
            }

            chrome.storage.local.get([storageKey], (result) => {
                callback(result[storageKey] || []);
            });
        })
        .catch(() => {
            chrome.storage.local.get([storageKey], (result) => {
                callback(result[storageKey] || []);
            });
        });
}

async function ensureSubtitleData(sub, tabId) {
    if (!sub || !sub.url) return sub;
    if (typeof sub.data === 'string' && sub.data.length > 0) return sub;

    try {
        const response = await sendRuntimeMessage({
            action: 'get-subtitle-data',
            tabId,
            url: sub.url
        });
        if (response && typeof response.data === 'string' && response.data.length > 0) {
            return { ...sub, data: response.data };
        }
    } catch (error) {
        console.warn('[Popup] 从 background 获取字幕数据失败:', error.message);
    }

    try {
        const subtitleUrl = sub.url.startsWith('//') ? `https:${sub.url}` : sub.url;
        const response = await fetch(subtitleUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.text();
        if (data) {
            return { ...sub, url: subtitleUrl, data };
        }
    } catch (error) {
        console.error('[Popup] 直连拉取字幕失败:', error);
    }

    return { ...sub, data: '' };
}


// extractSubtitleText 和 markdownToHtml 函数已移至 utils.js 公共模块
