# 变更：动画绑定改为文档写入

## 原因

`Animations.source` 住在 ComposeDocument 里，写入却走**页面文件** Store
（`setFrameAnimation`）。Store 校验的是**上次保存**的那份文档，于是新画出来、尚未保存的场景
不在其中，绑定被拒。

用户看到的是：建两块场景，只有第一块能创建动画。选中第二块里的对象、切到动画模式、点
「创建动画」——面板毫无反应。实际发生的是动画文件已经建好、绑定被 Store 以
「Entity … 不是 Frame」拒绝、catch 里换成一句通用的「操作失败」，磁盘上留下一个没有任何
引用的孤儿动画文件。

同一处错位还逼出过另一个补丁：会话中途绑定只进了页面文件、运行时文档并不知道，保存时直接
写运行时文档会把刚绑好的引用覆盖掉，因此保存前不得不把 `source` 从页面文件补回待存文档
（`carryFrameAnimationSources`）。两个症状同源——**文档状态却由文档之外的通道写入**。

## 变更内容

- **新增 `animation.source.set` 命令**，把 `Animations.source` 的关联/更换/解除变成一次普通
  文档事务：写入保留 `items`，与清单写入对称。绑定因此可撤销，且立刻对运行时文档生效。
- **编辑器绑定改走该命令**，不再在绑定时写页面文件。新场景不必先保存就能创建动画。
- **`use-page-workspace` 的 `setPageAnimation` 降为「载入动画文件并更新会话桶」**，不再改写
  页面文件；文件内容仍是静态权威，页面保存时照旧把各 Frame 镜像合并回写。
- **删除 `carryFrameAnimationSources`**：绑定从一开始就在运行时文档里，保存不再需要对账。
- 文件选择器与「复用页面已有动画文件」的判断改读**运行时文档**，不再读上次保存的那份。
- 创建动画失败时不留孤儿文件：先确认能绑定，再落文件。

## 非目标

- 不改动画文件格式，仍是按 Frame 分区的 `animationSchemaVersion: 2`。
- 不改 Store 的 `setFrameAnimation`：它仍是宿主可用的按 Frame 乐观并发写入，只是编辑器的
  交互路径不再经过它。
- 不改页面脚本与激活场景的写入方式——它们是真正的页面文件字段，不在文档里。
- 不引入「一块场景多条动画」。

## 影响

- 受影响的规范：`scene-animation`（动画关联写入）、`pages`（Frame 级动画绑定）、
  `editor-workspace-layout`（动画模式与创建引导）
- 受影响的代码：`packages/animation`（新命令）、
  `packages/editor/src/pages/use-page-workspace.ts`、
  `packages/editor/src/compose-editor/compose-editor.tsx`、
  `packages/editor/src/animation-mode/`、`e2e/`
- 顺带修复：给未保存的场景创建动画失败并留下孤儿动画文件；绑定后保存会覆盖绑定。
