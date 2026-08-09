# @compose-ui/asset-browser

独立的双栏资源浏览器。左侧使用 `@compose-ui/components` Tree 懒加载目录，右侧始终显示当前目录网格。
文件单击只更新选择；双击或 Enter 会通过 `onAssetOpen` 发出显式打开意图。图片/SVG 安全预览、二进制
元数据或按需加载的 Monaco 脚本编辑器由可独立组合的 `ComposeAssetPreview` 提供，适合放入宿主的文档标签。

```tsx
import { ComposeAssetBrowser } from '@compose-ui/asset-browser'
import '@compose-ui/asset-browser/styles.css'

<ComposeAssetBrowser
  provider={provider}
  onAssetOpen={(entry) => openAssetDocument(entry)}
  style={{ height: 560 }}
/>
```

Provider 是资源事实来源，资源写入使用不透明 `revision` 与 `expectedRevision` 做乐观并发。
缺少方法或 capability 为 false 时动作会禁用。`onBeforeAssetMutation` 可在 rename、move、delete 前
异步允许或拒绝整批操作。资源选择、展开和分隔条只存活于组件实例，不会进入 ComposeDocument、History
或 Operation Log。

```tsx
import { ComposeAssetPreview } from '@compose-ui/asset-browser'

<ComposeAssetPreview
  entry={entry}
  provider={provider}
  onDirtyChange={setDirty}
  onSaved={refreshEntry}
/>
```

预览卸载时会取消迟到读取、回收 Blob URL，并释放 Monaco editor/model 与 ResizeObserver。其 ref 暴露
`save(): Promise<boolean>`，供宿主在关闭 dirty 文档前确认保存结果。

宿主可通过 `ComposeAssetPreview.scriptIntelligence` 为特定 JavaScript 会话提供
`ComposeScriptIntelligenceProfile`。Profile 只使用字符串和 UTF-16 offset 描述隐藏插入与额外 `.d.ts`
声明，不暴露 Monaco 类型。Asset Browser 会保留一份只用于分析的 JavaScript shadow model，将补全、
悬浮、调用参数与 diagnostics 映射回可见源码，但不显示类型 Inlay Hint；dirty 比较和 Provider 写入
始终只使用可见 model。类型错误不会阻止保存，卸载会同时清理 shadow model、marker、provider 与额外声明。

Provider、Entry、错误和批处理类型只由轻量 `@compose-ui/assets` 定义；本包不转导资源协议。
当 Provider 同时提供引用 capability、稳定 `assetKey` 和 `resolveAsset` 时，树和目录网格中的
SVG/位图可通过 `onCanvasDrag` 发出普通数据生命周期；脚本、目录和未知二进制不会进入该拖拽。
资源目录内的 move 仍优先于画布拖入。

浏览器支持 File System Access API 时，可在用户手势中调用
`openComposeFileSystemAssetProvider()`；本包不会自动持久化目录句柄。

资源树与目录网格的右键菜单复用 `@compose-ui/components` 的 `ComposeContextMenu`：右键目标会先同步
资源选择，再由本包根据 Provider capability 决定新建、重命名、移动和删除动作是否可用。重命名和
删除会在菜单末尾分别显示现有键盘动作 `F2` 与 `Delete`。
