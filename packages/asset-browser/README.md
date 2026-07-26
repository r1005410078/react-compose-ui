# @compose-ui/asset-browser

独立的双栏资源浏览器。左侧使用 `@compose-ui/components` Tree 懒加载目录，右侧显示目录网格、
图片/SVG 安全预览、二进制元数据或按需加载的 Monaco 脚本编辑器。

```tsx
import { ComposeAssetBrowser } from '@compose-ui/asset-browser'
import '@compose-ui/asset-browser/styles.css'

<ComposeAssetBrowser provider={provider} style={{ height: 560 }} />
```

Provider 是资源事实来源，资源写入使用不透明 `revision` 与 `expectedRevision` 做乐观并发。
缺少方法或 capability 为 false 时动作会禁用。资源选择、分隔条和 dirty 状态只存活于组件实例，
不会进入 ComposeDocument、History 或 Operation Log。

Provider、Entry、错误和批处理类型只由轻量 `@compose-ui/assets` 定义；本包不转导资源协议。
当 Provider 同时提供引用 capability、稳定 `assetKey` 和 `resolveAsset` 时，树和目录网格中的
SVG/位图可通过 `onCanvasDrag` 发出普通数据生命周期；脚本、目录和未知二进制不会进入该拖拽。
资源目录内的 move 仍优先于画布拖入。

浏览器支持 File System Access API 时，可在用户手势中调用
`openComposeFileSystemAssetProvider()`；本包不会自动持久化目录句柄。
