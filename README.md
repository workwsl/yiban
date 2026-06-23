# 译伴 · 双语网页翻译

基于 Manifest V3 的 Chrome / Edge 浏览器扩展，使用 DeepSeek、Qwen 或 OpenAI-compatible 大模型，为网页提供双语翻译与划词翻译能力。

## 功能特性

- **整页双语翻译**：扫描页面文本节点，在原内容下方插入译文，不破坏原有布局
- **划词翻译**：选中文字后显示翻译按钮，快速查看单段译文
- **快捷键切换**：`Alt + A` 开启 / 停止当前页翻译
- **多模型支持**：DeepSeek、Qwen、任意 OpenAI-compatible 接口
- **提示词配置**：内置通用 / 技术文档风格，支持自定义 AI 专家提示词
- **翻译缓存**：本地 IndexedDB 缓存，减少重复请求
- **网站黑名单**：指定域名永不自动翻译
- **安全设计**：API Key 仅保存在扩展本地存储，由 Background Service Worker 发起请求，不暴露给网页

## 技术栈

| 类别 | 技术 |
|------|------|
| 扩展规范 | Manifest V3 |
| 语言 | TypeScript |
| 构建 | Vite 6 |
| UI | React 19 |
| 包管理 | pnpm |
| 存储 | `chrome.storage.local` + IndexedDB |

## 环境要求

- Node.js >= 20
- pnpm
- Chrome 或 Edge 浏览器

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 构建扩展

```bash
pnpm build
```

构建产物输出到 `dist/` 目录。

### 3. 加载到浏览器

1. 打开 Chrome / Edge，访问 `chrome://extensions/` 或 `edge://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目根目录下的 `dist/` 文件夹

### 4. 配置模型

首次使用前，需要在扩展设置页填写 API Key：

1. 点击扩展图标 → 左下角「设置」，或右键扩展图标 →「选项」
2. 进入「模型配置」，编辑 DeepSeek / Qwen 预设，或添加新的 OpenAI-compatible 模型
3. 填写 API Key 后，点击「测试连接」确认可用
4. 将常用模型设为默认

预设模型参考：

| Provider | Base URL | 默认模型 |
|----------|----------|----------|
| DeepSeek | `https://api.deepseek.com` | `deepseek-chat` |
| Qwen | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| OpenAI-compatible | 自定义 | 自定义 |

## 使用说明

### Popup 快捷操作

点击浏览器工具栏中的扩展图标，可以：

- 选择目标语言与翻译模型
- 切换 AI 专家（提示词风格）
- 开始 / 停止当前页翻译
- 开启 / 关闭划词翻译

### 快捷键

在普通网页（非输入框聚焦状态）下按 `Alt + A`，可切换当前页的翻译状态。

### 设置页

| 模块 | 说明 |
|------|------|
| 通用设置 | 默认目标语言、翻译风格、翻译缓存 |
| 提示词设置 | 编辑内置提示词或新增自定义 AI 专家 |
| 模型配置 | 管理 API 模型、测试连接、设置默认模型 |
| 网站黑名单 | 配置永不翻译的域名 |

## 开发

```bash
# 类型检查
pnpm typecheck

# 开发模式（监听文件变更并重新构建）
pnpm dev
```

开发时修改源码后需重新执行构建，并在 `chrome://extensions/` 中点击扩展的「重新加载」按钮。

本地测试页面位于 `test-pages/`，可直接用浏览器打开 HTML 文件，配合已加载的扩展进行功能验证：

- `article.html` — 文章页
- `technical-doc.html` — 技术文档
- `long-page.html` — 长页面分批翻译
- `form.html` — 表单页
- `nav.html` — 导航页
- `roadmap.html` — 路线图

## 项目结构

```text
项目根目录/
├── src/
│   ├── background/       # Service Worker、消息路由
│   ├── content/          # 内容脚本：DOM 扫描、译文渲染、划词翻译
│   ├── popup/            # 扩展 Popup 界面
│   ├── options/          # 设置页
│   ├── providers/        # 模型 API 接入层
│   ├── storage/          # 配置存储与翻译缓存
│   ├── shared/           # 类型定义、消息协议、提示词
│   ├── icons/            # 扩展图标
│   └── manifest.json     # 扩展清单
├── test-pages/           # 本地测试页面
├── docs/                 # 技术方案设计文档
├── dist/                 # 构建输出（已 gitignore）
├── vite.config.ts
├── tsconfig.json
└── package.json
```

更详细的架构设计见 [docs/yiban-tech-design.md](docs/yiban-tech-design.md)。

## 隐私说明

- API Key 与翻译配置仅保存在浏览器本地（`chrome.storage.local`）
- 翻译请求由扩展 Background 发起，网页脚本无法读取 Key
- 翻译缓存存储在本地 IndexedDB，不会上传到第三方（模型 API 请求除外）

## 许可证

Private — 当前为私有项目（`package.json` 中 `"private": true`）。
