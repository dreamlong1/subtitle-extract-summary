/**
 * 公共工具函数模块
 * 包含可在多个脚本中复用的通用函数
 */

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 将 Markdown 文本转换为 HTML
 * 支持：标题(h1-h4)、粗体、斜体、代码块、行内代码、列表、引用
 * @param {string} md - Markdown 格式的文本
 * @returns {string} - 转换后的 HTML 字符串
 */
function markdownToHtml(md) {
    if (!md) return '';
    const safeMd = escapeHtml(md);

    return safeMd
        // 标题 (h4 → h2，按优先级处理)
        .replace(/^#### (.*$)/gim, '<h5 style="margin: 12px 0 6px; font-weight: 600; font-size: 13px;">$1</h5>')
        .replace(/^### (.*$)/gim, '<h4 style="margin: 16px 0 8px; font-weight: 600;">$1</h4>')
        .replace(/^## (.*$)/gim, '<h3 style="margin: 20px 0 10px; font-weight: 600; color: #1d1d1f;">$1</h3>')
        .replace(/^# (.*$)/gim, '<h2 style="margin: 0 0 16px; font-weight: 700;">$1</h2>')
        // 粗体和斜体
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        // 代码块
        .replace(/```[\w]*\n([\s\S]*?)```/gim, '<pre style="background: #f5f5f5; padding: 12px; border-radius: 6px; font-size: 12px; overflow-x: auto;">$1</pre>')
        // 行内代码
        .replace(/`([^`]+)`/gim, '<code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 12px;">$1</code>')
        // 列表
        .replace(/^\s*- (.*$)/gim, '<li style="margin-left: 20px;">$1</li>')
        .replace(/^\s*\d+\. (.*$)/gim, '<li style="margin-left: 20px;">$1</li>')
        // 换行
        .replace(/\n\n/gim, '<br><br>')
        .replace(/\n/gim, '<br>');
}

/**
 * 提取字幕纯文本内容（去除 XML/JSON 标签和时间戳）
 * @param {string} data - 原始字幕数据
 * @param {string} url - 字幕来源 URL（用于判断格式）
 * @returns {string} - 纯文本字幕内容
 */
function extractSubtitleText(data, url) {
    try {
        // Bilibili JSON format
        if (url.includes('bilibili') || url.includes('hdslb.com')) {
            const json = JSON.parse(data);
            if (json.body && Array.isArray(json.body)) {
                return json.body.map(item => item.content).filter(Boolean).join('\n');
            }
        }

        // YouTube XML format
        if ((url.includes('youtube') || url.includes('timedtext')) && !data.trim().startsWith('{') && !data.trim().startsWith('[')) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data, 'text/xml');
            const textNodes = xmlDoc.querySelectorAll('text');
            const lines = [];
            textNodes.forEach(node => {
                const text = node.textContent.trim();
                if (text) lines.push(text);
            });
            return lines.join('\n');
        }

        // JSON format (generic)
        if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
            const json = JSON.parse(data);
            // Try common patterns
            if (json.body) return extractSubtitleText(JSON.stringify(json.body), url);
            if (json.events) return json.events.map(e => e.segs?.map(s => s.utf8).join('') || '').filter(Boolean).join('\n');
            // Fallback: stringify
            return JSON.stringify(json, null, 2);
        }

        // Plain text fallback
        return data;
    } catch (e) {
        console.error('[utils] Failed to extract subtitle text:', e);
        return data; // Return raw data as fallback
    }
}

// 导出函数（如果在模块环境中使用）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { markdownToHtml, extractSubtitleText };
}
