# 译伴（Yiban）技术方案设计

## 1. 技术目标

本方案面向 MVP v0.1，实现一款基于 Manifest V3 的 Chrome / Edge 浏览器插件，支持网页双语翻译、选中文本翻译、本地模型配置、DeepSeek / Qwen / OpenAI-compatible 接入、基础缓存和基础错误处理。

核心技术目标：

1. 插件结构清晰，后续可以扩展 PDF、OCR、字幕、自动翻译等能力。
2. 翻译逻辑不阻塞页面主交互，长页面采用分批处理。
3. API Key 只保存在扩展侧，不暴露给网页上下文。
4. DOM 处理尽量保守，优先保证不破坏原网页布局。
5. 模型接入层统一，DeepSeek、Qwen 和 OpenAI-compatible 共用主要请求流程。

## 2. 技术选型

### 2.1 浏览器扩展规范

使用 Manifest V3。

原因：

1. Chrome / Edge 当前主推扩展规范。
2. 支持 `service_worker` 作为后台脚本。
3. 支持 `chrome.scripting` 注入内容脚本。
4. 权限模型更适合插件商店审核。

### 2.2 前端技术

MVP 推荐使用 TypeScript + Vite + React。

理由：

1. Popup、Options、页面内浮层都需要组件化 UI。
2. TypeScript 能约束模型配置、消息协议、翻译任务状态等核心结构。
3. Vite 适合构建多入口扩展项目。
4. 后续扩展复杂设置页时维护成本更低。

如果希望极简实现，也可以使用原生 HTML/CSS/TypeScript，但 Options 页和状态管理会更快变复杂。

### 2.3 存储方案

MVP 存储建议：

1. 用户设置、模型配置、网站规则：`chrome.storage.local`
2. 翻译缓存：IndexedDB

原因：

1. 配置数据体量小，使用 `chrome.storage.local` 简单可靠。
2. 翻译缓存可能较大，IndexedDB 更适合批量读写和容量增长。
3. 后续可以把 IndexedDB 缓存封装为独立仓储层，便于迁移。

### 2.4 网络请求位置

模型 API 请求统一由 `background service worker` 发起。

原因：

1. 避免 API Key 暴露给网页 DOM 或页面脚本。
2. 统一管理模型配置、超时、错误处理、限流和重试。
3. 规避 content script 与网页环境边界带来的安全风险。

## 3. 插件模块架构

```text
extension
├── manifest.json
├── src
│   ├── background
│   │   ├── service-worker.ts
│   │   ├── message-router.ts
│   │   ├── translation-orchestrator.ts
│   │   └── context-menu.ts
│   ├── content
│   │   ├── content-script.ts
│   │   ├── dom-scanner.ts
│   │   ├── translation-renderer.ts
│   │   ├── selection-translator.ts
│   │   └── floating-ui.ts
│   ├── popup
│   │   ├── Popup.tsx
│   │   └── main.tsx
│   ├── options
│   │   ├── Options.tsx
│   │   └── main.tsx
│   ├── shared
│   │   ├── types.ts
│   │   ├── messages.ts
│   │   ├── constants.ts
│   │   ├── prompts.ts
│   │   └── errors.ts
│   ├── providers
│   │   ├── base.ts
│   │   ├── openai-compatible.ts
│   │   ├── deepseek.ts
│   │   └── qwen.ts
│   ├── storage
│   │   ├── settings-store.ts
│   │   ├── model-store.ts
│   │   ├── rule-store.ts
│   │   └── translation-cache.ts
│   └── queue
│       └── translation-queue.ts
└── public
    └── icons
```

## 4. 模块职责

### 4.1 Manifest

负责声明插件入口、权限、内容脚本、后台 service worker、Popup、Options。

MVP 权限建议：

```json
{
  "permissions": ["storage", "activeTab", "scripting", "contextMenus"],
  "host_permissions": [
    "https://api.deepseek.com/*",
    "https://dashscope.aliyuncs.com/*"
  ]
}
```

OpenAI-compatible 的自定义 Base URL 会带来动态 host 权限问题。MVP 有两个可选方案：

1. 使用 `<all_urls>` 作为模型 API 请求权限，功能简单但审核风险更高。
2. 首版限制 OpenAI-compatible 使用用户手动添加的常见域名，后续再做 optional host permissions。

推荐 MVP 初期开发使用 `<all_urls>`，发布前再收紧权限。

### 4.2 Background Service Worker

职责：

1. 管理跨模块消息。
2. 读取模型配置和用户设置。
3. 发起模型 API 请求。
4. 管理右键菜单。
5. 执行连接测试。
6. 返回标准化错误。

不负责：

1. 扫描 DOM。
2. 插入译文。
3. 控制网页内 UI 细节。

### 4.3 Content Script

职责：

1. 扫描当前网页可翻译文本。
2. 跳过代码块、输入框、隐藏元素和已翻译节点。
3. 将文本节点转换为翻译任务片段。
4. 接收译文并插入页面。
5. 管理选中文本翻译浮层。
6. 管理页面内翻译进度浮窗。

不负责：

1. 直接读取 API Key。
2. 直接请求模型服务。
3. 持久化模型配置。

### 4.4 Popup

职责：

1. 展示当前页面翻译状态。
2. 触发翻译当前页面。
3. 暂停 / 停止当前翻译。
4. 切换目标语言。
5. 切换当前模型。
6. 打开 Options 设置页。

### 4.5 Options

职责：

1. 管理模型配置。
2. 测试模型连接。
3. 管理默认目标语言。
4. 管理网站黑名单。
5. 管理缓存开关和清理。
6. 展示隐私说明。
7. 导入 / 导出配置，P1。

### 4.6 Providers

职责：

1. 屏蔽不同模型服务商接口差异。
2. 统一输入 `TranslateRequest`。
3. 统一输出 `TranslateResponse`。
4. 标准化错误类型。

MVP 中 DeepSeek 和 OpenAI-compatible 可共用 Chat Completions 适配器。Qwen 优先支持 OpenAI-compatible 模式；如果使用 DashScope 原生接口，则单独实现 `qwen.ts`。

## 5. 核心数据结构

### 5.1 用户设置

```ts
export interface UserSettings {
  defaultTargetLanguage: string;
  defaultModelId: string | null;
  displayMode: 'bilingual' | 'translation_only' | 'hover';
  translationStyle: 'general' | 'technical';
  cacheEnabled: boolean;
  autoTranslate: boolean;
}
```

### 5.2 模型配置

```ts
export type ModelProvider = 'deepseek' | 'qwen' | 'openai-compatible';

export interface ModelConfig {
  id: string;
  provider: ModelProvider;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  timeoutMs: number;
  maxConcurrency: number;
  maxCharsPerRequest: number;
}
```

### 5.3 翻译片段

```ts
export interface TranslationSegment {
  id: string;
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  context?: {
    tagName?: string;
    url?: string;
    title?: string;
  };
}
```

### 5.4 翻译结果

```ts
export interface TranslationResult {
  id: string;
  sourceText: string;
  translatedText: string;
  fromCache: boolean;
}
```

### 5.5 页面翻译状态

```ts
export interface PageTranslationState {
  tabId: number;
  status: 'idle' | 'scanning' | 'translating' | 'paused' | 'stopped' | 'completed' | 'failed';
  total: number;
  completed: number;
  failed: number;
  startedAt?: number;
  updatedAt?: number;
  errorMessage?: string;
}
```

## 6. 消息协议

Popup、Options、Content Script 和 Background 通过 `chrome.runtime.sendMessage`、`chrome.tabs.sendMessage` 通信。

### 6.1 Popup 到 Content

```ts
type PopupToContentMessage =
  | { type: 'PAGE_TRANSLATE_START'; targetLanguage: string; modelId: string }
  | { type: 'PAGE_TRANSLATE_PAUSE' }
  | { type: 'PAGE_TRANSLATE_RESUME' }
  | { type: 'PAGE_TRANSLATE_STOP' }
  | { type: 'PAGE_STATUS_GET' };
```

### 6.2 Content 到 Background

```ts
type ContentToBackgroundMessage =
  | { type: 'SEGMENTS_TRANSLATE'; payload: TranslateBatchRequest }
  | { type: 'SELECTION_TRANSLATE'; payload: TranslateTextRequest }
  | { type: 'CACHE_GET'; payload: CacheGetRequest }
  | { type: 'CACHE_SET'; payload: CacheSetRequest };
```

### 6.3 Options 到 Background

```ts
type OptionsToBackgroundMessage =
  | { type: 'MODEL_TEST'; modelConfig: ModelConfig }
  | { type: 'SETTINGS_GET' }
  | { type: 'SETTINGS_SAVE'; settings: UserSettings };
```

### 6.4 Background 到 Content

```ts
type BackgroundToContentMessage =
  | { type: 'TRANSLATION_RESULT'; result: TranslationResult }
  | { type: 'TRANSLATION_BATCH_RESULT'; results: TranslationResult[] }
  | { type: 'TRANSLATION_ERROR'; error: NormalizedError };
```

## 7. 网页翻译流程

### 7.1 手动翻译当前页面

```text
用户点击 Popup 翻译按钮
  -> Popup 向当前 tab 的 content script 发送 PAGE_TRANSLATE_START
  -> Content Script 检查页面状态和黑名单
  -> DOM Scanner 扫描可翻译文本节点
  -> Content Script 将节点转换为 TranslationSegment
  -> Translation Queue 分批处理片段
  -> 每批片段先检查缓存
  -> 未命中缓存的片段发送给 Background
  -> Background 调用 Provider 请求模型 API
  -> Background 返回译文
  -> Content Script 插入译文
  -> 更新页面内进度和 Popup 状态
```

### 7.2 选中文本翻译

```text
用户选中文本
  -> Content Script 显示浮动翻译按钮
  -> 用户点击按钮
  -> Content Script 发送 SELECTION_TRANSLATE
  -> Background 调用默认模型
  -> Content Script 在选区附近显示翻译浮层
```

## 8. DOM 文本提取策略

### 8.1 扫描方式

推荐使用 `TreeWalker` 扫描文本节点。

理由：

1. 可以直接处理真实文本节点。
2. 比按标签批量 `querySelectorAll` 更细粒度。
3. 方便跳过特定父节点。

候选节点条件：

1. 文本非空。
2. 文本长度大于最小阈值，建议 2 到 4 个字符。
3. 文本不是纯数字、URL、邮箱。
4. 节点可见。
5. 父级不在排除标签内。
6. 父级未标记为已翻译。

### 8.2 排除标签

```ts
const EXCLUDED_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEXTAREA',
  'INPUT',
  'SELECT',
  'OPTION',
  'PRE',
  'CODE',
  'KBD',
  'SAMP',
  'SVG',
  'CANVAS'
]);
```

### 8.3 可见性判断

基础判断：

1. `offsetParent !== null`
2. `getComputedStyle(element).display !== 'none'`
3. `visibility !== 'hidden'`
4. `opacity !== '0'`
5. `getBoundingClientRect()` 有有效宽高

MVP 可以接受少量误判，后续再针对虚拟列表、固定定位和 Shadow DOM 优化。

### 8.4 分组策略

MVP 推荐按“块级父元素”分组，而不是每个文本节点单独请求。

示例：

1. 对 `p`、`li`、`blockquote`、`td`、`th`、`h1` - `h6` 直接作为段落单位。
2. 对普通 `div`，如果文本较短且不包含复杂子结构，可以作为段落单位。
3. 对包含代码或复杂内联元素的节点，保守处理文本子节点。

## 9. 译文插入策略

### 9.1 默认双语显示

默认在原文块级元素后插入译文元素：

```html
<p>Original paragraph.</p>
<p class="yiban-translation" data-yiban-segment-id="...">译文段落。</p>
```

### 9.2 样式隔离

使用固定类名前缀 `yiban-`，避免污染网页样式。

基础样式（译文继承原文字号与颜色，独立成行显示）：

```css
.yiban-translation {
  display: block;
  margin-top: 0.35em;
  font: inherit;
  color: inherit;
  line-height: inherit;
}
```

### 9.3 防重复插入

每个已处理原文节点添加标记：

```html
data-yiban-translated="true"
data-yiban-segment-id="..."
```

插入的译文本身也标记：

```html
data-yiban-owned="true"
```

重新翻译时先移除 `data-yiban-owned="true"` 的旧译文，再执行新翻译。

## 10. 翻译队列设计

### 10.1 队列能力

队列运行在 Content Script 中，负责：

1. 分批提交片段。
2. 控制页面侧状态。
3. 支持暂停、恢复、停止。
4. 接收批量结果后触发渲染。
5. 在用户停止时丢弃后续结果。

API 请求并发由 Background 根据模型配置控制。Content Script 可以按批次串行提交，避免页面状态过复杂。

### 10.2 批处理策略

默认策略：

1. 每批最大字符数：模型配置 `maxCharsPerRequest`，默认 3000。
2. 每批最大片段数：建议 10。
3. 短文本合并请求。
4. 超长段落按句子或字符长度切分，P1。

### 10.3 批量结果格式

为了降低模型输出不可控风险，提示词要求模型按 JSON 数组返回：

```json
[
  { "id": "seg_1", "text": "译文 1" },
  { "id": "seg_2", "text": "译文 2" }
]
```

MVP 需要实现容错解析：

1. 尝试直接解析 JSON。
2. 尝试提取代码块中的 JSON。
3. 解析失败时将整批标记失败。
4. 后续可降级为逐条请求。

## 11. 模型适配设计

### 11.1 统一接口

```ts
export interface TranslationProvider {
  translateBatch(request: TranslateBatchRequest, config: ModelConfig): Promise<TranslateBatchResponse>;
  testConnection(config: ModelConfig): Promise<ModelTestResult>;
}
```

### 11.2 OpenAI-compatible 请求

DeepSeek 和多数 Qwen OpenAI-compatible endpoint 可使用同一结构：

```json
{
  "model": "deepseek-chat",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "temperature": 0.2
}
```

### 11.3 DeepSeek

默认配置：

```json
{
  "provider": "deepseek",
  "baseUrl": "https://api.deepseek.com",
  "model": "deepseek-chat"
}
```

请求路径：

```text
/chat/completions
```

### 11.4 Qwen

MVP 推荐优先支持 Qwen 的 OpenAI-compatible 调用方式，减少适配复杂度。

默认配置可以预置：

```json
{
  "provider": "qwen",
  "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
  "model": "qwen-plus"
}
```

请求路径：

```text
/chat/completions
```

### 11.5 错误标准化

```ts
export type ErrorCode =
  | 'API_KEY_MISSING'
  | 'API_KEY_INVALID'
  | 'MODEL_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INSUFFICIENT_QUOTA'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN';

export interface NormalizedError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  provider?: ModelProvider;
  status?: number;
}
```

## 12. Prompt 设计

### 12.1 批量翻译系统提示词

```text
You are a professional translation engine.
Translate the user's input into the target language.
Return only a valid JSON array.
Each item must keep the same id and contain the translated text.
Do not add explanations, notes, summaries, or extra fields.
Preserve URLs, emails, code, commands, variable names, function names, file paths, and product names when appropriate.
```

### 12.2 用户输入模板

```json
{
  "targetLanguage": "zh-CN",
  "style": "technical",
  "segments": [
    { "id": "seg_1", "text": "Original text." }
  ]
}
```

### 12.3 技术文档模式

技术文档模式额外强调：

1. 保留 API 名称。
2. 保留代码符号。
3. 保留命令行参数。
4. 翻译简洁准确，不口语化。

## 13. 缓存设计

### 13.1 Cache Key

```text
sha256(sourceText + targetLanguage + modelId + promptVersion + translationStyle)
```

### 13.2 IndexedDB 结构

数据库名：`yiban_translation_cache`

对象仓库：`translations`

字段：

```ts
export interface TranslationCacheRecord {
  key: string;
  sourceText: string;
  translatedText: string;
  sourceLanguage?: string;
  targetLanguage: string;
  modelId: string;
  promptVersion: string;
  translationStyle: string;
  createdAt: number;
  updatedAt: number;
  hitCount: number;
}
```

索引：

1. `key`
2. `modelId`
3. `targetLanguage`
4. `createdAt`

### 13.3 缓存读写流程

```text
Content Script 生成片段
  -> 对每个片段计算 cache key
  -> IndexedDB 查询缓存
  -> 命中则直接渲染
  -> 未命中则提交 Background 翻译
  -> 翻译成功后写入缓存
```

缓存是否放在 Content Script 侧或 Background 侧都可行。MVP 推荐放在 Content Script 侧，减少消息往返；但 API Key 和模型请求仍放在 Background。

## 14. 网站规则与黑名单

MVP 只实现黑名单。

```ts
export interface SiteRule {
  domain: string;
  rule: 'manual' | 'always_translate' | 'never_translate';
  targetLanguage?: string;
  modelId?: string;
}
```

判断逻辑：

1. 获取当前 `location.hostname`。
2. 精确匹配域名。
3. 支持父域匹配，例如 `docs.example.com` 可匹配 `example.com`，P1。
4. 如果规则为 `never_translate`，Content Script 阻止翻译并提示用户。

## 15. 安全设计

### 15.1 API Key

1. 仅存储在 `chrome.storage.local`。
2. 仅 Background 读取。
3. 不通过 Content Script 发送到网页侧。
4. 不写入日志。
5. 错误信息中不拼接完整请求头。

### 15.2 页面数据

1. 默认只在用户触发翻译时读取页面文本。
2. 不读取输入框、密码框、文本域内容。
3. 不读取隐藏元素。
4. 发送到模型服务的文本由用户配置的服务商处理，设置页必须明确提示。

### 15.3 内容脚本隔离

1. 插入元素使用 `yiban-` 前缀。
2. 不修改网页原有脚本。
3. 不覆盖全局变量。
4. 页面内浮层可以使用 Shadow DOM，P1。

## 16. 性能设计

### 16.1 页面扫描

1. 使用 `TreeWalker`。
2. 每轮处理限定节点数量，长页面可分片扫描。
3. 首版可以先扫描全文，若页面节点过多则提示使用视口翻译，P1。

### 16.2 渲染

1. 批量插入译文，减少频繁 DOM 操作。
2. 已翻译节点打标记。
3. 停止翻译时不强制移除已翻译内容，除非用户选择“清除译文”。

### 16.3 网络

1. 默认并发 3。
2. 单请求超时 30 秒。
3. 429、5xx 可重试，最多 2 次。
4. 401、403、模型不存在不重试。

## 17. MVP 目录结构建议

```text
.
├── docs
│   ├── browser-bilingual-translation-plugin-prd.md
│   └── browser-bilingual-translation-plugin-tech-design.md
├── package.json
├── vite.config.ts
├── tsconfig.json
├── manifest.config.ts
├── public
│   └── icons
└── src
    ├── background
    ├── content
    ├── options
    ├── popup
    ├── providers
    ├── queue
    ├── shared
    └── storage
```

## 18. 开发里程碑

### 18.1 Milestone 1：插件基础架构

交付：

1. Vite + TypeScript 项目。
2. Manifest V3。
3. Popup 页面。
4. Options 页面。
5. Background service worker。
6. Content script 注入成功。

验收：

1. 插件可在 Chrome 开发者模式加载。
2. Popup 可打开。
3. Options 可打开。
4. Content script 可向 Background 通信。

### 18.2 Milestone 2：模型配置与连接测试

交付：

1. 模型配置表单。
2. DeepSeek 默认配置。
3. Qwen 默认配置。
4. OpenAI-compatible 配置。
5. 测试连接能力。

验收：

1. 用户保存 API Key。
2. 点击测试连接可以得到成功或明确错误。
3. API Key 不出现在页面 DOM 和 console。

### 18.3 Milestone 3：网页文本提取与双语渲染

交付：

1. DOM Scanner。
2. 排除代码块和输入框。
3. Translation Renderer。
4. 防重复插入。

验收：

1. 普通英文文章可扫描出段落。
2. 翻译结果可插入原文下方。
3. 代码块不被翻译。
4. 输入框不被读取。

### 18.4 Milestone 4：翻译队列、缓存与停止

交付：

1. 翻译队列。
2. 批量请求。
3. IndexedDB 缓存。
4. 停止翻译。
5. 基础进度状态。

验收：

1. 长页面可以逐批翻译。
2. 重复文本可以命中缓存。
3. 用户点击停止后不再继续请求。

### 18.5 Milestone 5：选中文本翻译与黑名单

交付：

1. 选中文本浮动按钮。
2. 选区翻译浮层。
3. 网站黑名单。
4. 基础错误提示。

验收：

1. 选中文本后可以翻译。
2. 黑名单网站不会执行页面翻译。
3. API Key 错误时提示清晰。

## 19. 测试策略

### 19.1 单元测试

重点覆盖：

1. 文本过滤规则。
2. Cache key 生成。
3. 模型响应解析。
4. 错误标准化。
5. 批处理分组。

### 19.2 集成测试

重点覆盖：

1. Popup 到 Content 的消息。
2. Content 到 Background 的翻译请求。
3. Options 保存模型配置。
4. 缓存命中流程。

### 19.3 手工测试页面

建议准备本地 fixtures：

1. 普通文章页。
2. 技术文档页，包含代码块和行内代码。
3. 表格页面。
4. 长页面。
5. 动态加载页面。
6. 表单页面。

## 20. 待确认技术问题

1. 发布版是否允许使用 `<all_urls>` 作为模型 API host 权限。
2. 是否首版强制 Qwen 使用 OpenAI-compatible 模式。
3. 翻译缓存是否需要按网站维度管理。
4. 是否需要在 MVP 支持 Shadow DOM 内文本翻译。
5. 是否需要在 MVP 支持 SPA 路由变化后自动重新扫描。
6. 是否需要将页面内浮层使用 Shadow DOM 隔离。
7. 是否需要支持“清除当前页面译文”命令。

## 21. 推荐 MVP 决策

为了减少首版复杂度，建议 MVP 采用以下决策：

1. 插件框架：Manifest V3 + TypeScript + Vite + React。
2. 模型请求：全部由 Background service worker 发起。
3. DeepSeek / Qwen：优先走 OpenAI-compatible Chat Completions。
4. 缓存：IndexedDB。
5. 翻译显示：只实现双语对照。
6. 页面翻译：手动触发，首版不自动翻译。
7. 长页面：先做批处理，不做视口懒加载。
8. 黑名单：只做 `never_translate`。
9. 权限：开发期可宽松，发布前收紧。
10. PDF / OCR / 字幕：不进入 MVP。
