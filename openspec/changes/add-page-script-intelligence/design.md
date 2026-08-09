# 设计：页面 Setup 脚本隐藏类型层

## 目标与边界

Setup 源码仍是不经编译的自包含 JavaScript。类型声明、`@ts-check` 与 inline JSDoc
只插入 Monaco shadow model，不进入可见 model、dirty 基线、Provider 写入或 Runtime Loader。

`@compose-ui/asset-browser` 不识别页面或 Script Runtime。Editor 通过中立 Profile 注入按
UTF-16 offset 表达的隐藏文本；Asset Browser 只负责模型映射和 Monaco 生命周期。

## 模型与数据流

1. Script Editor 使用 `compose-intelligent-javascript` 创建可见 model，该语言复用
   Monaco JavaScript Monarch tokenizer 与 language configuration。
2. Profile 根据可见源码返回排序且不重叠的隐藏插入：文件头的
   `// @ts-check` 与 setup 参数前的 inline JSDoc；Runtime 声明作为 JavaScript Language
   Service 的额外 `.d.ts` 注入，避免在 `.js` shadow model 中产生 TypeScript 语法错误。
3. Asset Browser 应用插入得到 shadow source，以 `javascript` language 和独立 URI
   创建隐藏 model。
4. 补全、悬浮、签名与诊断通过 TypeScript Worker 查询 shadow
   model，再按插入段将 offset/range 映射回可见 model。触及隐藏文本的结果被丢弃。
5. 可见 model 改变时重建 shadow source 并 debounce 诊断；卸载时释放两个 model、
   marker、监听和 session registry。

## 公共协议

```ts
interface ComposeVirtualTextInsertion {
  readonly offset: number
  readonly text: string
}

interface ComposeScriptIntelligenceProfile {
  readonly id: string
  readonly language: 'javascript'
  readonly typeDeclarations?: string
  createVirtualInsertions(source: string): readonly ComposeVirtualTextInsertion[]
  getSourceDiagnostics?(source: string): readonly {
    readonly message: string
    readonly start: number
    readonly end: number
    readonly severity: 'hint' | 'warning' | 'error'
  }[]
}
```

`ComposeAssetPreviewProps.scriptIntelligence` 是可选的；未注入时完全保留现有脚本
编辑流程。非法 offset、重叠插入或 Profile 抛错时降级为普通 JavaScript，不影响
输入和保存。

## Setup 识别

Editor 在页面能力启用时对 `*.setup.js` 或页面菜单显式打开的 setup 资源注入
Profile。纯扫描器跳过注释、字符串和模板文本，定位下列直接导出形式的参数：

- `export function setup(ctx)`
- `export const setup = (ctx) =>`
- `export const setup = function (ctx)`

无法定位时保留着色与普通 JavaScript 能力，并显示不阻断保存的诊断。

## 类型与错误策略

- Runtime 公共常量 `COMPOSE_PAGE_SCRIPT_TYPE_DECLARATIONS` 描述 Context、State、Computed
  和 Setup，通过契约测试防止与 TypeScript API 漂移。
- Context 方法的声明内置中文用途、参数、响应式生命周期和示例，供补全详情、Hover 与
  Signature Help 直接展示；示例使用 `javascript` fenced code block，经 Monaco 原生
  `IMarkdownString` renderer 着色。这些文档同样只存在于隐藏声明中。
- Monaco 没有独立的 Suggest Details 默认高度公开选项；详情面板按 Markdown 内容自适应并
  保留内建拖拽调整。`suggestLineHeight` 只控制建议项与详情文本行高，不使用内部 CSS 强制高度。
- 参数使用隐藏 `/** @type {ComposePageScriptContext} */` inline JSDoc，保留 setup
  返回对象的精确推导。
- Inlay Hint 完全关闭；类型继续参与补全、悬浮、签名与 diagnostics，但不在代码行内显示
  推导结果。
- 语法和语义 marker 只是建议，保存契约不读取 marker。

## 风险与处理

- Worker 结果迟到：以 session generation 与 model 内容版本丢弃过期结果。
- 隐藏文本错误泄漏：所有 worker range 必须通过反向映射，不可映射的结果不展示。
- 全局 Monaco 污染：自定义 language/provider 只查询已登记 session，普通 JS/TS model
  仍使用 Monaco 内建提供器。
- 类型提示与 Runtime 错误不同步：Editor marker 只辅助创作，Runtime diagnostic 仍是
  实际加载与执行的事实来源。
