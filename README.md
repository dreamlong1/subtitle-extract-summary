# 🎬 字幕提取总结插件

[English](./README_EN.md)

> Chrome 扩展 · 自动提取 YouTube / Bilibili 字幕 · 一键 AI 总结

## 安装

```bash
git clone https://github.com/dreamlong1/subtitle-extractor.git
```

打开 `chrome://extensions` → 开启**开发者模式** → 拖入项目文件夹

## 使用

1. 打开 YouTube 或 Bilibili 视频，**确保已开启字幕**
2. 播放视频，插件自动拦截字幕
3. 点击扩展图标 → 选择语言 → **下载**或**总结**

### AI 总结配置

点击弹窗 ⚙️ 进入设置页，填写：

| 字段 | 示例 |
|------|------|
| API 地址 | `https://api.deepseek.com` |
| API Key | `sk-...` |
| 模型 | `deepseek-chat` / `gpt-4o-mini` |

兼容所有 OpenAI 格式的 API。内置 4 套 Prompt 模板，支持自定义。
