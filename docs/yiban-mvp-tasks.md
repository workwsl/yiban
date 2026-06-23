# 译伴（Yiban）MVP 开发任务拆解

## 1. 文档目标

本文档将 PRD 和技术方案拆解为 MVP v0.1 的可执行开发任务。任务顺序遵循从基础工程到核心翻译能力的路径：

1. 搭建插件工程。
2. 打通 Popup、Options、Content Script、Background 通信。
3. 完成模型配置与 API 调用。
4. 完成网页文本提取和双语渲染。
5. 完成翻译队列、缓存、停止能力。
6. 完成选中文本翻译、黑名单和错误处理。
7. 完成基础测试和手工验收。

## 2. MVP 范围确认

### 2.1 必做范围

1. Chrome / Edge Manifest V3 插件。
2. TypeScript + Vite + React 工程。
3. Popup 页面。
4. Options 设置页。
5. Background service worker。
6. Content script。
7. DeepSeek / Qwen / OpenAI-compatible 模型配置。
8. 模型连接测试。
9. 手动翻译当前网页。
10. 双语对照显示。
11. 选中文本翻译。
12. 基础 IndexedDB 翻译缓存。
13. 网站黑名单。
14. 暂停 / 停止翻译中的停止能力优先，暂停可作为 P1。
15. 基础错误提示。

### 2.2 不进入 MVP

1. 自动翻译。
2. PDF 翻译。
3. OCR 图片翻译。
4. 视频字幕翻译。
5. 多模型对比。
6. 云同步。
7. 账号系统。
8. 付费系统。
9. Firefox / Safari。
10. 完整术语表。

## 3. 里程碑总览

| 里程碑 | 目标 | 产出 |
| --- | --- | --- |
| M1 | 插件工程可运行 | 可加载的 MV3 插件 |
| M2 | 插件模块通信打通 | Popup / Options / Content / Background 可互通 |
| M3 | 模型配置可用 | 可保存模型并测试连接 |
| M4 | 页面文本提取可用 | 可扫描网页可翻译文本 |
| M5 | 页面双语翻译可用 | 可调用模型并插入译文 |
| M6 | 队列与缓存可用 | 可分批翻译、缓存复用、停止任务 |
| M7 | 选中文本与黑名单可用 | 可翻译选区、可阻止黑名单网站 |
| M8 | 验收与发布准备 | 基础测试、构建产物、手工验收通过 |

## 4. M1：插件工程基础

### T1.1 初始化项目工程

任务内容：

1. 创建 `package.json`。
2. 配置 TypeScript。
3. 配置 Vite。
4. 配置 React。
5. 配置基础目录结构。

建议目录：

```text
src
├── background
├── content
├── options
├── popup
├── providers
├── queue
├── shared
└── storage
```

验收标准：

1. `npm install` 或 `pnpm install` 可安装依赖。
2. `npm run build` 或 `pnpm build` 可成功构建。
3. 构建产物输出到 `dist`。

### T1.2 配置 Manifest V3

任务内容：

1. 创建 `manifest.json` 或 manifest 生成配置。
2. 配置 `background.service_worker`。
3. 配置 `action.default_popup`。
4. 配置 `options_page`。
5. 配置 content script。
6. 配置基础权限。

MVP 权限：

```json
["storage", "activeTab", "scripting", "contextMenus"]
```

验收标准：

1. Chrome 开发者模式可以加载 `dist`。
2. 插件图标可见。
3. 点击插件图标可以打开 Popup。
4. 插件详情页可以打开 Options。

### T1.3 添加基础图标与元信息

任务内容：

1. 添加 16、32、48、128 尺寸图标。
2. 配置插件名称。
3. 配置插件描述。
4. 配置版本号 `0.1.0`。

验收标准：

1. 插件加载后显示正确名称和图标。
2. Manifest 不出现图标路径错误。

## 5. M2：基础通信链路

### T2.1 定义共享类型和消息协议

任务内容：

1. 创建 `src/shared/types.ts`。
2. 创建 `src/shared/messages.ts`。
3. 定义用户设置、模型配置、翻译片段、翻译结果、页面状态。
4. 定义 Popup、Options、Content、Background 之间的消息类型。

验收标准：

1. 各模块引用同一套类型。
2. TypeScript 能校验消息 payload。

### T2.2 实现 Background 消息路由

任务内容：

1. 创建 `message-router.ts`。
2. 监听 `chrome.runtime.onMessage`。
3. 按消息 `type` 分发处理函数。
4. 为未知消息返回标准错误。

验收标准：

1. Popup 可以向 Background 发送 ping 并收到 pong。
2. Options 可以向 Background 发送 ping 并收到 pong。
3. Content Script 可以向 Background 发送 ping 并收到 pong。

### T2.3 实现 Popup 到当前页面通信

任务内容：

1. Popup 获取当前 active tab。
2. Popup 向 content script 发送 `PAGE_STATUS_GET`。
3. Content Script 返回页面翻译状态。

验收标准：

1. Popup 能显示当前页面状态。
2. 如果当前页面不支持注入，Popup 有明确提示。

### T2.4 实现 Options 基础读写

任务内容：

1. Options 请求默认设置。
2. Background 或 storage 层返回设置。
3. Options 保存设置。

验收标准：

1. 修改默认目标语言后刷新 Options 仍然保留。
2. 设置保存失败时有错误提示。

## 6. M3：模型配置与连接测试

### T3.1 实现模型配置存储

任务内容：

1. 创建 `model-store.ts`。
2. 使用 `chrome.storage.local` 保存模型配置。
3. 支持新增、编辑、删除、读取默认模型。
4. 初始化 DeepSeek 和 Qwen 默认配置模板。

验收标准：

1. 用户可以保存 DeepSeek 配置。
2. 用户可以保存 Qwen 配置。
3. 用户可以保存 OpenAI-compatible 配置。
4. API Key 刷新后仍保留。

### T3.2 实现 Options 模型配置 UI

任务内容：

1. Provider 选择。
2. Base URL 输入。
3. Model Name 输入。
4. API Key 输入。
5. 超时时间输入。
6. 最大并发数输入。
7. 单次最大字符数输入。
8. 保存按钮。
9. 删除按钮。
10. 设置默认模型按钮。

验收标准：

1. 表单可以创建模型。
2. 表单可以编辑模型。
3. 删除模型前有确认。
4. 默认模型在列表中有明确标识。

### T3.3 实现 Provider 统一接口

任务内容：

1. 创建 `providers/base.ts`。
2. 创建 `providers/openai-compatible.ts`。
3. 创建 `providers/deepseek.ts`。
4. 创建 `providers/qwen.ts`。
5. 实现 `translateBatch` 和 `testConnection`。

验收标准：

1. DeepSeek 可以调用 `/chat/completions`。
2. Qwen OpenAI-compatible 可以调用 `/chat/completions`。
3. OpenAI-compatible 可以使用自定义 Base URL。

### T3.4 实现连接测试

任务内容：

1. Options 点击测试连接。
2. Background 读取临时模型配置。
3. Provider 发起短文本测试请求。
4. 返回成功或标准化错误。

测试文本：

```text
Translate "Hello" to Simplified Chinese. Return only the translation.
```

验收标准：

1. 正确 API Key 返回成功。
2. 错误 API Key 返回明确提示。
3. 网络失败返回明确提示。
4. Console 不输出 API Key。

## 7. M4：网页文本提取

### T4.1 实现 DOM Scanner

任务内容：

1. 使用 `TreeWalker` 扫描文本节点。
2. 过滤空文本。
3. 过滤过短文本。
4. 过滤 URL、邮箱、纯数字。
5. 过滤隐藏元素。
6. 过滤排除标签内部文本。
7. 过滤已翻译节点。

排除标签：

```text
script, style, noscript, textarea, input, select, option,
pre, code, kbd, samp, svg, canvas
```

验收标准：

1. 普通文章段落可被识别。
2. 标题可被识别。
3. 列表可被识别。
4. 代码块不被识别。
5. 输入框内容不被识别。

### T4.2 实现翻译片段生成

任务内容：

1. 为每个候选文本生成 `TranslationSegment`。
2. 生成稳定的 segment id。
3. 保存 segment id 与 DOM 节点引用的映射。
4. 记录上下文信息，例如 tagName、url、title。

验收标准：

1. 扫描结果包含 id 和 text。
2. 可通过 id 找回对应 DOM 节点。
3. 同一轮翻译 id 不重复。

### T4.3 实现扫描调试视图

任务内容：

1. 开发阶段在 Popup 显示可翻译片段数量。
2. Content Script 支持返回扫描摘要。

验收标准：

1. 点击扫描后 Popup 显示片段总数。
2. 无可翻译内容时提示明确。

## 8. M5：页面双语翻译

### T5.1 实现翻译请求编排

任务内容：

1. Content Script 接收 `PAGE_TRANSLATE_START`。
2. 读取目标语言和模型 ID。
3. 执行 DOM 扫描。
4. 发送翻译片段到 Background。
5. 接收翻译结果。

验收标准：

1. Popup 点击翻译后能触发页面扫描。
2. Content Script 能收到 Background 返回的译文。

### T5.2 实现 Prompt 构建

任务内容：

1. 创建 `prompts.ts`。
2. 支持通用翻译提示词。
3. 支持技术文档提示词。
4. 支持批量 JSON 输出要求。

验收标准：

1. 批量请求包含 segment id。
2. 模型返回后可根据 id 对齐译文。

### T5.3 实现模型响应解析

任务内容：

1. 解析 JSON 数组。
2. 支持提取 Markdown 代码块中的 JSON。
3. 校验返回 id。
4. 校验 text 字段。
5. 解析失败时返回 `INVALID_RESPONSE`。

验收标准：

1. 标准 JSON 可解析。
2. ```json 代码块中的 JSON 可解析。
3. 非法返回会显示错误，不导致页面崩溃。

### T5.4 实现双语译文插入

任务内容：

1. 创建 `translation-renderer.ts`。
2. 在原文块后插入译文元素。
3. 添加 `yiban-translation` 类。
4. 添加 `data-yiban-owned` 标记。
5. 原文节点添加 `data-yiban-translated` 标记。

验收标准：

1. 译文显示在原文下方。
2. 重复点击翻译不会重复插入多份译文。
3. 页面主要布局不明显错乱。

## 9. M6：翻译队列、缓存与停止

### T6.1 实现批处理分组

任务内容：

1. 按最大字符数分批。
2. 按最大片段数分批。
3. 超过限制时拆分到下一批。

默认值：

1. 每批最大字符数：3000。
2. 每批最大片段数：10。

验收标准：

1. 长页面不会一次性提交全部文本。
2. 批次字符数不超过配置上限。

### T6.2 实现 Translation Queue

任务内容：

1. 创建 `translation-queue.ts`。
2. 支持 pending、running、completed、failed 状态。
3. 支持停止。
4. 每批完成后更新进度。

验收标准：

1. Popup 能显示翻译进度。
2. 单批失败不影响后续批次，除非是 API Key 错误。
3. 点击停止后不再发起新请求。

### T6.3 实现 IndexedDB 缓存

任务内容：

1. 创建 `translation-cache.ts`。
2. 初始化数据库 `yiban_translation_cache`。
3. 创建对象仓库 `translations`。
4. 实现 `get`、`set`、`delete`、`clear`。
5. 实现 cache key 生成。

验收标准：

1. 翻译成功后写入缓存。
2. 同一文本、目标语言、模型、提示词版本再次翻译时命中缓存。
3. Options 可以清空缓存。

### T6.4 实现基础进度浮窗

任务内容：

1. 页面右下角显示翻译进度。
2. 显示总数、已完成、失败数。
3. 提供停止按钮。
4. 翻译完成后自动收起或显示完成状态。

验收标准：

1. 翻译中用户能看到进度。
2. 点击停止生效。
3. 浮窗不明显遮挡主要阅读区域。

## 10. M7：选中文本翻译、黑名单和错误处理

### T7.1 实现选中文本翻译按钮

任务内容：

1. 监听用户选中文本。
2. 判断选区文本是否有效。
3. 在选区附近显示小型翻译按钮。
4. 点击按钮触发选区翻译。

验收标准：

1. 选中普通文本后出现按钮。
2. 选中文本为空或过短时不出现按钮。
3. 点击页面其他区域后按钮消失。

### T7.2 实现选区翻译浮层

任务内容：

1. 显示翻译结果。
2. 支持复制译文。
3. 支持关闭浮层。
4. 翻译失败时显示错误。

验收标准：

1. 选中文本可得到译文。
2. 浮层位置接近选区。
3. 浮层不会无限累积。

### T7.3 实现网站黑名单

任务内容：

1. Options 支持添加黑名单域名。
2. Options 支持删除黑名单域名。
3. Content Script 翻译前检查当前域名。
4. 命中黑名单时阻止翻译。

验收标准：

1. 黑名单网站点击翻译不会发送 API 请求。
2. Popup 显示当前网站已禁用翻译。
3. 移除黑名单后可重新翻译。

### T7.4 实现错误标准化与展示

任务内容：

1. 定义 `NormalizedError`。
2. 标准化 API Key 错误。
3. 标准化限流错误。
4. 标准化超时错误。
5. 标准化网络错误。
6. Popup、Options、页面浮窗展示错误。

验收标准：

1. 错误提示能指导用户下一步。
2. 不展示完整 API Key。
3. 错误不会导致插件 UI 卡死。

## 11. M8：测试、构建与验收

### T8.1 单元测试

建议覆盖：

1. 文本过滤规则。
2. URL / 邮箱 / 纯数字识别。
3. 批处理分组。
4. Cache key 生成。
5. 模型响应 JSON 解析。
6. 错误标准化。

验收标准：

1. 核心纯函数有单元测试。
2. 测试命令可一键执行。

### T8.2 手工测试 fixtures

任务内容：

创建 `fixtures` 或 `test-pages` 目录，包含：

1. `article.html`：普通文章。
2. `technical-doc.html`：技术文档，包含代码块和行内代码。
3. `table.html`：表格页面。
4. `form.html`：表单页面。
5. `long-page.html`：长页面。

验收标准：

1. 本地打开测试页可验证扫描和翻译。
2. 代码块不被翻译。
3. 表单输入不被读取。
4. 长页面可分批翻译。

### T8.3 浏览器手工验收

验收清单：

1. 插件可加载。
2. Popup 可打开。
3. Options 可打开。
4. 可保存模型配置。
5. 可测试 DeepSeek。
6. 可测试 Qwen。
7. 可翻译普通英文网页。
8. 可翻译选中文本。
9. 可停止翻译。
10. 可命中缓存。
11. 黑名单生效。
12. API Key 错误提示清晰。

### T8.4 发布前构建检查

任务内容：

1. 执行类型检查。
2. 执行测试。
3. 执行生产构建。
4. 检查 `dist` 中是否包含源码 map，按发布策略决定是否保留。
5. 检查 Manifest 权限是否过宽。
6. 检查 API Key 不会被写入构建产物。

验收标准：

1. 构建无错误。
2. 插件可从 `dist` 加载。
3. 没有明显敏感信息泄露。

## 12. 推荐开发顺序

1. T1.1 初始化项目工程
2. T1.2 配置 Manifest V3
3. T2.1 定义共享类型和消息协议
4. T2.2 实现 Background 消息路由
5. T2.3 实现 Popup 到当前页面通信
6. T3.1 实现模型配置存储
7. T3.2 实现 Options 模型配置 UI
8. T3.3 实现 Provider 统一接口
9. T3.4 实现连接测试
10. T4.1 实现 DOM Scanner
11. T4.2 实现翻译片段生成
12. T5.1 实现翻译请求编排
13. T5.2 实现 Prompt 构建
14. T5.3 实现模型响应解析
15. T5.4 实现双语译文插入
16. T6.1 实现批处理分组
17. T6.2 实现 Translation Queue
18. T6.3 实现 IndexedDB 缓存
19. T6.4 实现基础进度浮窗
20. T7.1 实现选中文本翻译按钮
21. T7.2 实现选区翻译浮层
22. T7.3 实现网站黑名单
23. T7.4 实现错误标准化与展示
24. T8.1 单元测试
25. T8.2 手工测试 fixtures
26. T8.3 浏览器手工验收
27. T8.4 发布前构建检查

## 13. 风险任务优先级

以下任务存在较高技术风险，应尽早验证：

1. T3.3 Provider 统一接口：不同模型响应格式、错误格式可能不一致。
2. T4.1 DOM Scanner：真实网页 DOM 差异大，容易误扫或漏扫。
3. T5.3 模型响应解析：大模型可能不严格返回 JSON。
4. T5.4 双语译文插入：容易影响原页面布局。
5. T6.3 IndexedDB 缓存：需要处理扩展上下文中的兼容性和容量问题。
6. T7.1 选中文本翻译按钮：选区定位和页面滚动场景需要仔细处理。

建议在正式实现前先做两个技术 Spike：

1. Spike A：在真实网页上验证 DOM Scanner + 译文插入。
2. Spike B：用 DeepSeek 和 Qwen 分别验证批量 JSON 翻译稳定性。

## 14. MVP 完成定义

MVP 完成需要同时满足：

1. 用户可以加载插件并完成模型配置。
2. 用户可以测试 DeepSeek 或 Qwen 连接。
3. 用户可以在普通英文网页上点击翻译并看到双语结果。
4. 用户可以选中文本并看到翻译浮层。
5. 代码块、输入框不会被翻译。
6. 重复翻译可以使用缓存。
7. 用户可以停止正在进行的页面翻译。
8. 黑名单网站不会触发翻译。
9. 常见错误有明确提示。
10. 构建产物可以在 Chrome / Edge 开发者模式加载。

## 15. 后续 P1 任务池

MVP 完成后优先考虑：

1. 自动翻译规则。
2. 视口懒加载翻译。
3. SPA 路由变化监听。
4. 清除当前页面译文。
5. 仅译文模式。
6. 悬浮译文模式。
7. 样式自定义。
8. 缓存按网站清理。
9. 导入 / 导出配置。
10. 术语表。
11. Shadow DOM UI 隔离。
12. 更严格的 host permissions 管理。
