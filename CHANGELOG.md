# Changelog

本项目的所有重要变更均记录于此。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.2.0] - 2026-06-29

### Added

- **输入翻译 · 译文 Markdown 渲染**：译文输出区支持 Markdown 渲染，含标题、列表、代码块、引用、GFM 表格等
- 新增 `react-markdown`、`remark-gfm` 依赖
- 新增 [`src/translator/components/MarkdownOutput.tsx`](src/translator/components/MarkdownOutput.tsx) 组件，外链默认新标签打开并附带 `rel="noopener noreferrer"`

### Changed

- 输入翻译页译文由纯文本 `<p>` 改为 Markdown 渲染展示
- 补充 `.output-markdown` 暗色主题样式（标题、代码、表格、链接等）
- 通用翻译提示词增加说明：原文含 Markdown 时，译文保留同等结构

## [0.1.0] - 2026-06-29

### Added

- 译伴 Chrome/Edge 扩展 MVP（Manifest V3）
- **整页双语翻译**：扫描页面文本节点，在原内容下方插入译文
- **划词翻译**：选中文本后显示浮动翻译按钮
- **输入翻译**：独立翻译页，支持实时输入与自动翻译
- **快捷键**：`Alt + A` 开启 / 停止当前页翻译
- **多模型支持**：DeepSeek、Qwen、OpenAI-compatible 接口
- **提示词配置**：内置通用 / 技术文档风格，支持自定义 AI 专家
- **翻译缓存**：本地 IndexedDB 缓存，减少重复 API 调用
- **网站黑名单**：指定域名永不自动翻译
- Popup 快捷操作与设置页（通用、提示词、模型、黑名单）

[Unreleased]: https://github.com/workwsl/yiban/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/workwsl/yiban/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/workwsl/yiban/releases/tag/v0.1.0
