# @compose-ui/assets

与 React、DOM、ComposeDocument 和资源浏览界面无关的轻量资源协议包。它定义
`ComposeAssetProvider`、稳定 `ComposeAssetReference` 与 Stage/Preview 使用的
`ComposeAssetResolver`。

```ts
import { createComposeAssetResolver } from '@compose-ui/assets'

const assetResolver = createComposeAssetResolver(assetProvider)
```

可写入组件 props 的引用只包含 `providerId`、不可变 `assetKey` 和作用域。资源重命名或移动可以
改变资源树 `entry.id`，但必须保持 `assetKey`；文件内容与 revision 不进入 ComposeDocument。
`persistent` 引用由宿主负责跨会话解析，`session` 引用仅保证当前 Provider 连接内可用。

Provider 只有同时声明 `capabilities.reference`、为文件提供 `assetKey` 并实现 `resolveAsset`
时，资源浏览器才允许把文件拖入 Stage。`createComposeAssetResolver` 始终解析 Provider 的最新
内容，Provider 订阅只触发 renderer 重新读取，不创建文档事务。
