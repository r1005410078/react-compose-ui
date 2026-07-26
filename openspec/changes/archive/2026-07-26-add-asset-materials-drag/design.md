## Context

Asset Browser Provider 使用异步 Blob 读取，Stage/Preview 通过 Component Registry 渲染文档。
若把 Blob URL 或 Data URL 写入节点，前者无法持久化，后者会放大文档、Patch 和 History。
materials 也不得依赖包含 Monaco 的 Asset Browser UI 包。

## Goals / Non-Goals

- Goals: 稳定资源引用、最新内容解析、Image/SVG 物料、单/批量拖入和安全 SVG 改色。
- Non-goals: Inspector 资源选择器、替换已有节点、资源引用图、历史 revision、二进制持久化。

## Decisions

### Shared asset protocol

`@compose-ui/assets` 成为无 React 的协议包。Provider 树 ID 仍可变化，Canvas 引用使用不可变
`assetKey`。Resolver 返回 Blob、revision 与 mediaType；Provider 更新只通知 renderer 重读，
不会产生文档命令。

### Registry-owned asset seed

Component definition 可声明 `assetDrop`。Registry 按注册顺序选择首个匹配 definition，并隔离
异步 seed factory 错误。Stage 只处理坐标、父级、并发和事务，不了解 Image/SVG props。

### Drag lifecycle

Asset Browser 发出不含 React Event 的 start/move/end/cancel 事件。Editor 把事件映射到当前
StageInteractionController。资源内部移动完成时取消 Canvas drop，避免一次手势产生两种写入。

### Rendering and security

Image renderer 自己拥有并回收 Blob URL。SVG 使用 DOMPurify SVG profile，随后再移除脚本、
foreignObject、动画、style、事件属性和外部 URL；只允许 `#fragment` 引用。填充覆盖不改变
显式 `none`，描边覆盖不为原本无描边的图形新增轮廓。

### Async drop

Stage 最多并发读取 4 项。成功 seed 以最多四列、24 世界单位间距布局；第一项中心锚定 drop
点。成功项组成一个 batch，失败项形成可访问汇总。等待期间目标 Frame 失效则回退 Canvas 根，
仍保持 drop 世界位置。

## Risks / Trade-offs

- Session File System reference 刷新后不可解析 → props 明确记录 scope，缺失时显示重连提示。
- SVG 内联扩大攻击面 → 双层白名单净化、禁止外链与可执行/动画内容，并建立恶意 fixture。
- 异步 drop 可能晚于文档变化 → 提交前读取最新文档和父级矩阵，卸载/resolver 更换时中止。
- 多张大图增加瞬时内存 → 并发限制为 4，renderer 和 Stage 都及时回收 URL/AbortController。
