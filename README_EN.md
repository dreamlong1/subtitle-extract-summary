# 🎬 Subtitle Extractor & Summarizer

[中文](./README.md)

> Chrome Extension · Auto-extract YouTube / Bilibili subtitles · One-click AI summary

## Installation

```bash
git clone https://github.com/dreamlong1/subtitle-extractor.git
```

Open `chrome://extensions` → Enable **Developer mode** → Drag in the project folder

## Usage

1. Open a YouTube or Bilibili video, **make sure subtitles are enabled**
2. Play the video, the extension auto-intercepts subtitles
3. Click the extension icon → Select language → **Download** or **Summarize**

### AI Summary Setup

Click ⚙️ in the popup to open settings:

| Field | Example |
|-------|---------|
| API URL | `https://api.deepseek.com` |
| API Key | `sk-...` |
| Model | `deepseek-chat` / `gpt-4o-mini` |

Compatible with all OpenAI-format APIs. Includes 4 built-in prompt templates with full customization support.

## Changelog

| Version | Date | Update |
|---------|------|--------|
| v1.1 | 2026-03-11 | AI summary, prompt templates, multi-config management |
| v1.0 | 2026-02-05 | Initial release, subtitle extraction & download |
