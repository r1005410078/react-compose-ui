# 任务

## 1. `animation.source.set` 命令（`packages/animation`）

- [x] 1.1 新增命令类型与 handler：改写 `Animations.source`（null 即解除），保留 `items`；
      与 `manifestPatch` 共用同一个「保留另一半」的写入函数。
- [x] 1.2 校验：`frameId` 必填且必须是 Frame；引用形状非法时拒绝。
- [x] 1.3 单测：关联/更换/解除保留 items；可撤销；非 Frame 被拒。

## 2. 编辑器绑定改走文档命令（`packages/editor`）

- [x] 2.1 `setPageAnimation` 降为「载入动画文件并更新会话桶」，不再写页面文件。
- [x] 2.2 `handlePageAnimationChanged` 派发 `animation.source.set` + 水合。
- [x] 2.3 文件选择器与「复用页面已有动画文件」的判断改读运行时文档。
- [x] 2.4 删除 `carryFrameAnimationSources` 及其保存前对账。
- [x] 2.5 创建动画：先确认有可绑定的作用域场景，再落文件。

## 3. 验证

- [x] 3.1 `bun run lint && bun run typecheck && bun run test && bun run build`
- [x] 3.2 新增 e2e：给刚画出来、未保存的第二块场景创建动画；两块场景各自的时间线互不干扰。
- [x] 3.3 既有 e2e 里「先保存再建动画」的前置步骤可以去掉——去掉后仍应通过。
- [x] 3.4 `bun run test:e2e`
- [x] 3.5 `openspec archive update-animation-binding-to-document --yes` 后
      `openspec validate --all --strict`

## 4. 实施记录

- 复现：建两块场景后选中第二块里的对象点「创建动画」，面板毫无反应。实际是
  `store.setFrameAnimation` 以「Entity … 不是 Frame」拒绝——它校验的是**上次保存**的页面文件
  文档，而第二块场景只存在于运行时文档里；catch 把它换成一句通用的「操作失败」，磁盘上留下
  一个没有引用的孤儿动画文件。
- 改成文档命令后，上一轮为了兜同一处错位加的 `carryFrameAnimationSources` 一并删除：绑定
  从写入那一刻起就在运行时文档里，保存不再需要对账。
- 既有 e2e 里「新建场景后先 Control+S 再建动画」的前置步骤已删除，删掉后仍然通过——这正是
  本变更要消除的那条约束。
