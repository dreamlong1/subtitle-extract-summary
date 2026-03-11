document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const navItems = document.querySelectorAll('.nav-item');
    const pageSettings = document.getElementById('page-settings');
    const pageAbout = document.getElementById('page-about');
    const pageGeneral = document.getElementById('page-general');
    const readmeContent = document.getElementById('readme-content');

    // General elements
    const optionsDebugMode = document.getElementById('options-debug-mode');

    // Provider elements
    const providerListContainer = document.getElementById('provider-list-container');
    const addProviderBtn = document.getElementById('add-provider-btn');
    const configPanel = document.getElementById('config-panel');
    const emptyState = document.getElementById('empty-state');
    const configForm = document.getElementById('config-form');
    const configTitle = document.getElementById('config-title');

    // Form elements - 基础配置
    const providerNameInput = document.getElementById('provider-name');
    const apiUrlInput = document.getElementById('api-url');
    const apiKeyInput = document.getElementById('api-key');
    const apiModelInput = document.getElementById('api-model');
    const showKeyCheckbox = document.getElementById('show-key');
    const saveBtn = document.getElementById('save-btn');
    const testBtn = document.getElementById('test-connection-btn');
    const statusMsg = document.getElementById('status-msg');

    // Form elements - Prompt 设置
    const systemPromptInput = document.getElementById('system-prompt');
    const customPromptInput = document.getElementById('custom-prompt');
    const promptTemplateSelector = document.getElementById('prompt-template-selector');


    // Form elements - 高级参数
    const maxTokensInput = document.getElementById('max-tokens');
    const maxTokensValue = document.getElementById('max-tokens-value');
    const temperatureInput = document.getElementById('temperature');
    const temperatureValue = document.getElementById('temperature-value');

    // Collapsible panels
    const collapsibles = document.querySelectorAll('.collapsible');

    // State
    let providers = []; // Array of provider configs
    let activeProviderId = null; // Currently active (selected for use)
    let editingProviderId = null; // Currently editing

    // 初始化折叠面板
    collapsibles.forEach(panel => {
        const header = panel.querySelector('.collapsible-header');
        header.addEventListener('click', () => {
            panel.classList.toggle('open');
        });
    });

    // 初始化 range 滑块实时更新
    maxTokensInput.addEventListener('input', () => {
        maxTokensValue.textContent = maxTokensInput.value;
    });
    temperatureInput.addEventListener('input', () => {
        temperatureValue.textContent = temperatureInput.value;
    });

    // Prompt 模板定义
    const PROMPT_TEMPLATES = {
        template1: {
            system: "你是一个专业且高效的内容分析师。你的任务是阅读视频的完整字幕，并将其提炼为结构清晰、易于阅读的总结笔记。请保持客观中立，使用 Markdown 格式排版。",
            custom: "请根据以下视频字幕，完成结构化总结：\n视频标题：{title}\n语言：{lang}\n\n请包含以下四个部分进行输出：\n1. 🎯 【一句话总结】：用 50 字以内概括视频的最核心主旨。\n2. 📝 【核心要点】：分点列出 3-5 个最重要的信息或观点（使用加粗突出关键词）。\n3. 💡 【深度解析】：简述视频中提到的关键案例、技术细节或论证过程。\n4. 思考/启示：这期视频能给我们带来什么价值或反思。\n\n字幕内容：\n{subtitle}"
        },
        template2: {
            system: "你是一位顶尖的常青藤名校教授助理，擅长从长篇大论中萃取知识精髓，将其转化为高质量的学习笔记。",
            custom: "这篇字幕来自视频《{title}》，语言为 {lang}。请阅读后为我生成一份高质量的“费曼技巧学习笔记”：\n\n1. 不要只是转述，请**重构内容的逻辑结构**，按主题分类输出。\n2. 提取出字幕中出现的所有**专有名词/核心概念**，并给出简明解释。\n3. 如果演讲者提出了某个问题，请明确写出对应的问题和解决思路。\n4. 请用清晰的 Markdown 层级标题 (H2, H3, 列表项) 进行组织编排。\n\n以下是字幕内容：\n{subtitle}"
        },
        template3: {
            system: "你是一位资深的记者与播客编辑，擅长捕捉多方对话中的思维火花，剔除寒暄和口水话，提炼出最有价值的 Q&A（问答）或观点碰撞。",
            custom: "以下是视频《{title}》的字幕提取文本。这通常是一个访谈或播客节目：\n\n请你帮我整理出：\n1. 访谈的核心议题是什么？\n2. 以【Q&A问答】的形式，列出对话中抛出的核心问题，以及被采访者的详细回答观点（精简但不要遗漏关键论据）。\n3. 提炼出采访中令人印象深刻的金句（如果有的话）。\n\n对话记录：\n{subtitle}"
        },
        template4: {
            system: "你是一个无情的摘要机器，你需要用最少的字数传递最大密度的信息。",
            custom: "请快速阅读《{title}》的字幕，并在 100 字以内告诉我：\n\n1. 这个视频到底在讲什么？\n2. 最终得出的结论是什么？\n3. 这个视频适合什么样的人看？\n\n内容：\n{subtitle}"
        }
    };

    // 监听模板选择
    promptTemplateSelector.addEventListener('change', (e) => {
        const template = PROMPT_TEMPLATES[e.target.value];
        if (template) {
            systemPromptInput.value = template.system;
            customPromptInput.value = template.custom;

            // 触发 input 事件以确保自动保存等逻辑如果存在的话能监听到
            systemPromptInput.dispatchEvent(new Event('input'));
            customPromptInput.dispatchEvent(new Event('input'));
        }
    });


    // Debug Mode Logic
    if (optionsDebugMode) {
        chrome.storage.local.get(['debugMode'], (result) => {
            optionsDebugMode.checked = result.debugMode || false;
        });

        optionsDebugMode.addEventListener('change', () => {
            chrome.storage.local.set({ debugMode: optionsDebugMode.checked });
        });
    }

    // Load providers from storage
    function loadProviders() {
        chrome.storage.local.get(['aiProviders', 'activeProviderId'], (result) => {
            providers = result.aiProviders || [];
            activeProviderId = result.activeProviderId || null;

            // 兼容旧版本：迁移 aiConfig 数据
            if (providers.length === 0) {
                chrome.storage.local.get(['aiConfig'], (oldResult) => {
                    if (oldResult.aiConfig && oldResult.aiConfig.key) {
                        const migrated = {
                            id: generateId(),
                            name: '默认配置',
                            url: oldResult.aiConfig.url || '',
                            key: oldResult.aiConfig.key || '',
                            model: oldResult.aiConfig.model || '',
                            prompt: oldResult.aiConfig.prompt || '',
                            systemPrompt: '',
                            maxTokens: 4000,
                            temperature: 0.7
                        };
                        providers = [migrated];
                        activeProviderId = migrated.id;
                        saveProviders();
                    }
                    renderProviderList();
                });
            } else {
                renderProviderList();
            }
        });
    }

    // Save providers to storage
    function saveProviders() {
        chrome.storage.local.set({
            aiProviders: providers,
            activeProviderId: activeProviderId
        });
    }

    // Generate unique ID
    function generateId() {
        return 'provider_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Render provider list
    function renderProviderList() {
        providerListContainer.innerHTML = '';

        if (providers.length === 0) {
            emptyState.style.display = 'block';
            configForm.style.display = 'none';
            return;
        }

        providers.forEach(provider => {
            const item = document.createElement('div');
            item.className = 'provider-item' + (editingProviderId === provider.id ? ' selected' : '');
            item.innerHTML = `
                <div class="provider-radio ${activeProviderId === provider.id ? 'active' : ''}" data-id="${provider.id}"></div>
                <span class="provider-name">${provider.name || '未命名'}</span>
                <span class="provider-delete" data-id="${provider.id}" title="删除">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </span>
            `;

            // Click to edit
            item.addEventListener('click', (e) => {
                if (e.target.closest('.provider-delete') || e.target.closest('.provider-radio')) return;
                editProvider(provider.id);
            });

            // Radio click to activate
            item.querySelector('.provider-radio').addEventListener('click', (e) => {
                e.stopPropagation();
                activateProvider(provider.id);
            });

            // Delete
            item.querySelector('.provider-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteProvider(provider.id);
            });

            providerListContainer.appendChild(item);
        });

        // Auto-select first if none editing
        if (!editingProviderId && providers.length > 0) {
            editProvider(providers[0].id);
        }
    }

    // Add new provider
    addProviderBtn.addEventListener('click', () => {
        const newProvider = {
            id: generateId(),
            name: '新配置 ' + (providers.length + 1),
            url: '',
            key: '',
            model: '',
            prompt: PROMPT_TEMPLATES.template3.custom,
            systemPrompt: PROMPT_TEMPLATES.template3.system,
            maxTokens: 4000,
            temperature: 0.7
        };
        providers.push(newProvider);

        // Auto-activate if first
        if (providers.length === 1) {
            activeProviderId = newProvider.id;
        }

        saveProviders();
        editProvider(newProvider.id);
        renderProviderList();
    });

    // Edit provider
    function editProvider(id) {
        editingProviderId = id;
        const provider = providers.find(p => p.id === id);
        if (!provider) return;

        emptyState.style.display = 'none';
        configForm.style.display = 'block';
        configTitle.textContent = provider.name || '编辑配置';

        // 基础配置
        providerNameInput.value = provider.name || '';
        apiUrlInput.value = provider.url || '';
        apiKeyInput.value = provider.key || '';
        apiModelInput.value = provider.model || '';

        // Prompt 设置
        systemPromptInput.value = provider.systemPrompt || '';
        customPromptInput.value = provider.prompt || '';

        let matchedTemplate = "";
        for (const [key, tpl] of Object.entries(PROMPT_TEMPLATES)) {
            if (provider.systemPrompt === tpl.system && provider.prompt === tpl.custom) {
                matchedTemplate = key;
                break;
            }
        }
        promptTemplateSelector.value = matchedTemplate;

        // 高级参数
        const maxTokens = provider.maxTokens || 4000;
        const temperature = provider.temperature !== undefined ? provider.temperature : 0.7;
        maxTokensInput.value = maxTokens;
        maxTokensValue.textContent = maxTokens;
        temperatureInput.value = temperature;
        temperatureValue.textContent = temperature;

        renderProviderList();
    }

    // Activate provider (set as current)
    function activateProvider(id) {
        activeProviderId = id;
        saveProviders();
        renderProviderList();
        showStatus('已切换到该配置', 'success');
    }

    // Delete provider
    function deleteProvider(id) {
        if (!confirm('确定要删除这个配置吗？')) return;

        providers = providers.filter(p => p.id !== id);

        if (activeProviderId === id) {
            activeProviderId = providers.length > 0 ? providers[0].id : null;
        }

        if (editingProviderId === id) {
            editingProviderId = providers.length > 0 ? providers[0].id : null;
        }

        saveProviders();
        renderProviderList();

        if (providers.length === 0) {
            emptyState.style.display = 'block';
            configForm.style.display = 'none';
        } else if (editingProviderId) {
            editProvider(editingProviderId);
        }
    }

    // Save current editing provider
    saveBtn.addEventListener('click', () => {
        if (!editingProviderId) return;

        const provider = providers.find(p => p.id === editingProviderId);
        if (!provider) return;

        // 基础配置
        provider.name = providerNameInput.value.trim() || '未命名';
        provider.url = apiUrlInput.value.trim();
        provider.key = apiKeyInput.value.trim();
        provider.model = apiModelInput.value.trim();

        // Prompt 设置
        provider.systemPrompt = systemPromptInput.value.trim();
        provider.prompt = customPromptInput.value.trim();

        // 高级参数
        const parsedMaxTokens = parseInt(maxTokensInput.value, 10);
        const parsedTemperature = parseFloat(temperatureInput.value);
        provider.maxTokens = Number.isFinite(parsedMaxTokens) ? parsedMaxTokens : 4000;
        provider.temperature = Number.isFinite(parsedTemperature) ? parsedTemperature : 0.7;

        configTitle.textContent = provider.name;
        saveProviders();
        renderProviderList();
        showStatus('配置已保存', 'success');
    });

    // Toggle password visibility
    showKeyCheckbox.addEventListener('change', () => {
        apiKeyInput.type = showKeyCheckbox.checked ? 'text' : 'password';
    });

    // Test connection
    testBtn.addEventListener('click', () => {
        const url = apiUrlInput.value.trim();
        const key = apiKeyInput.value.trim();
        const model = apiModelInput.value.trim();

        if (!url || !key) {
            showStatus('请先填写 API 地址和密钥', 'error');
            return;
        }

        statusMsg.style.display = 'none';
        testBtn.textContent = '测试中...';
        testBtn.style.opacity = '0.7';

        chrome.runtime.sendMessage({
            action: 'testConnection',
            config: { url, key, model }
        }, (response) => {
            testBtn.textContent = '连接测试';
            testBtn.style.opacity = '1';

            if (chrome.runtime.lastError) {
                showStatus(`通信错误: ${chrome.runtime.lastError.message}`, 'error');
                return;
            }

            if (response && response.success) {
                const latency = response.latency || 0;
                let msg = `连接成功！延迟: ${latency}ms`;

                // Check if AI actually replied something
                if (response.aiConnectionContent && response.aiConnectionContent.trim().length > 0) {
                    if (response.aiConnectionContent.startsWith('RAW:')) {
                        // 解析失败，显示原始数据片段
                        msg += ` (格式异常: ${response.aiConnectionContent.substring(5, 1000)}...)`;
                    } else {
                        // msg += ' (AI回复正常)'; // 正常时不显示
                    }
                } else {
                    msg += ' (AI无回复内容)';
                }

                showStatus(msg, 'success');
            } else {
                let errorDetails = (response && (response.data || response.error)) || 'Unknown Error';
                try {
                    const json = JSON.parse(errorDetails);
                    errorDetails = JSON.stringify(json, null, 2);
                } catch (e) { }
                if (errorDetails.length > 300) errorDetails = errorDetails.substring(0, 300) + '...';
                showStatus(`连接失败: ${errorDetails}`, 'error');
            }
        });
    });

    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            const page = item.dataset.page;
            pageSettings.style.display = page === 'settings' ? 'flex' : 'none';
            pageAbout.style.display = page === 'about' ? 'block' : 'none';
            if (pageGeneral) pageGeneral.style.display = page === 'general' ? 'block' : 'none';

            if (page === 'about') loadReadme();
        });
    });

    // Load README
    async function loadReadme() {
        if (readmeContent.dataset.loaded) return;
        try {
            const response = await fetch(chrome.runtime.getURL('README.md'));
            const text = await response.text();
            readmeContent.innerHTML = markdownToHtml(text);
            readmeContent.dataset.loaded = 'true';
        } catch (e) {
            readmeContent.innerHTML = '<p style="color: #999;">无法加载 README 文件</p>';
        }
    }

    // markdownToHtml 函数已移至 utils.js 公共模块

    function showStatus(text, type) {
        statusMsg.textContent = text;
        statusMsg.className = 'status-msg ' + (type === 'success' ? 'status-success' : 'status-error');
        statusMsg.style.display = 'block';

        if (type === 'success') {
            // setTimeout(() => statusMsg.style.display = 'none', 3000);
        }
    }

    // Initialize
    loadProviders();
});
