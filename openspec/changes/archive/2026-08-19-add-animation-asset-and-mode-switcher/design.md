# 设计：动画文件资产与设计/动画模式切换

## 上下文

动画清单目前只存在于 `ComposeDocument.animations`，由可撤销的 `animation.*` 命令
编辑；采样器、animation-panel 适配器与 preview 全部同步读取文档清单。要引入
文件资产又不推翻这条链路，需要明确唯一事实来源与同步时机。

## 目标/非目标

- 目标：动画成为可见、可绑定的文件资产；模式切换入口上移；空态语义修正。
- 非目标：多动画、脚本模式、组件文档动画入口、Provider media type 强制。

## 决策

### 事实来源：文件静态权威 + 文档会话镜像

动画文件是静态（at rest）权威；`ComposeDocument.animations` 是会话内工作镜像；
页面文件持有绑定引用；打开页面时水合、保存页面时回写。

- 采样器 `applyComposeAnimationAtTime(document, …)`、panel 适配器与 preview
  （`use-animation-playback.ts`、`preview-dialog.tsx` 均读
  `getComposeAnimations(document)[0]`）零改动。
- `animation.configure`/keyframe 命令保持在页面 `TransactionRuntime` 上可撤销；
  dirty 由 `runtime.revision` 派生，页面保存按钮自动覆盖清单变化。
- `TransactionRuntime` 没有整文档替换 API，因此水合发生在 `openPage` 里
  `createTransactionRuntime` 之前；加载失败保留内嵌镜像并显示警告。
- 保存文档中的镜像同时是动画文件缺失时的降级回退；多页面绑定同一文件时各自
  水合，回写用 `expectedRevision` 乐观并发暴露冲突。
- 考虑过的替代方案：动画文件全程权威、清单编辑改为 store 写入。被否：清单编辑
  失去撤销语义，且采样器/preview/panel 公共 API 全部要加清单参数，破坏面大。

### Undo 边界

创建/绑定/解绑动画文件是 store 写入、不可撤销（与页面 setup 脚本
`createScript` 先例一致）；随附的镜像水合（`animation.create`/`delete`）是普通
事务。撤销越过水合事务后时间线进入「有绑定、无镜像」态，CTA 按状态区分：
无绑定 → 创建动画（建文件+绑定+镜像）；有绑定无镜像 → 仅重新派发水合。
不做自动重水合（会与 Undo 对抗）。

### 页面文件兼容

`animation` 是加法字段：`parseComposePageFile` 容缺（缺失归一化为 `null`），
`pageSchemaVersion` 保持 1；序列化总是写出。旧构建因严格未知键校验会拒绝含
`animation` 的页面文件——属已知前向兼容限制，在提案中明示。

### 回写冲突

保存页面时若绑定清单相对基线有变化，用会话记录的动画文件 revision 做
`writeFile(expectedRevision)`。冲突时提示并允许强制覆盖（复用页面保存冲突的
交互从简处理），不引入独立三方合并。

## 风险/权衡

- Dockview `removePanel` 触发 active-panel 变化 → `setEditorMode` 防重入。
- 现有测试大量假设底部动画标签 → 显式迁移（integration.spec.ts 约 30 处）。
- 多页面复用同一动画文件的并发写 → `expectedRevision` 暴露冲突，last-save-wins。

## 迁移计划

纯加法：旧页面文件照常解析（`animation` 归一化为 null）；已有文档内嵌
`animations` 清单继续工作（无绑定时时间线显示创建引导，创建后迁移到文件由
用户显式操作，本期不自动迁移）。回滚即还原代码，页面文件中多出的
`animation: null` 字段被旧解析拒绝时需手工删除——发布说明中注明。
