# 变更：动画按场景独立——一页一份动画文件，按场景分区

## 原因

规范已经要求「一个页面的多个根 Frame MUST 能各自绑定不同的动画文件」
（`pages` 的 `按 Frame 绑定动画`），协议层也确实做到了：动画清单挂在所属 Frame 的
`Animations` Component 上，`page-store.setFrameAnimation(pageKey, frameId, ...)` 只改那一块。

**但编辑器会话层把「动画挂在哪块场景」固定成了一个值。** `use-page-workspace` 的会话有四个
标量字段——`animationFrameId`、`animationEntryId`、`animationRevision`、`animationManifest`
——`animationFrameId` 在打开页面时按 `activeFrameId` 定一次，此后：

- 打开页面只水合这一块的绑定文件（`:249`）
- 绑定动画文件只写这一块（`:472`）
- 保存只把这一块的镜像回写文件（`:357`）
- 文件选择器只读这一块（`compose-editor.tsx`）

于是多场景页面里只有一块场景能有动画，切换激活场景不换时间线。用户看到的是：在第二块场景
里创建动画，页面配置面板显示「绑定的动画尚未载入」。

此外 `ComposeAnimationFile` 只装**一条** `animation`，一页多块场景各自建动画会撞文件名。

## 变更内容

- **动画文件按场景分区。** `animationSchemaVersion` 升到 2：文件从单条 `animation` 改为按
  所属根 Frame 分区的集合。一个页面共用一份动画文件，不再随场景数量增生文件，也不需要
  发明命名策略。预览与发布只取目标场景的那一区。提供 1→2 的显式单向迁移。
- **多个根 Frame MAY 指向同一个动画文件。** 引用仍然逐 Frame 保存在 `Animations.source`
  上——解除某一块的绑定不影响其他块——但默认全部指向页面自己的那一份文件。
- **会话按 Frame 分桶。** 四个标量字段变成按 frameId 索引的映射，绑定、镜像水合与保存
  回写各自认自己的场景。
- **时间线跟随选中所属场景。** 作用域从「会话固定的那一块」改为
  `resolveTargetFrameId(document, selectedIds, activeFrameId)`：选中场景 B 里的任何东西，
  时间线就是 B 的；没有选择时回退激活场景。这与既有的
  `多画板下的 Frame 动作目标` 规范一致（选中优先、`activeFrameId` 只作回退）。
- **动画面板与页面配置面板的动画区块跟随同一个解析结果**，不再各自算一遍。

## 非目标

- **不动页面脚本。** `setupScript` 保持 `ComposePageFile` 上的页面级单值，多块场景共用一份
  setup。理由见 design.md 的决策 1；简言之：绑定是页面级平坦命名空间，动画自身的播放绑定
  也解析页面作用域，按场景切分脚本会凭空制造一类跨场景移动即失效的悬空引用。
- 不改 `ComposePageFile` 版本，也不改 `ComposeDocument` 版本。
- 不引入「一块场景多条动画」——每块场景仍只有一条，多动画选择留给后续提案。
- 不改动画采样、运动路径与关键帧编辑本身。

## 影响

- 受影响的规范：`scene-animation`（文件格式、Frame 关联写入）、`pages`（按 Frame 绑定动画）、
  `editor-workspace-layout`（动画作用域）
- 受影响的代码：`packages/animation`（文件协议与迁移）、
  `packages/editor/src/pages/use-page-workspace.ts`（会话分桶、水合、绑定、保存回写）、
  `packages/editor/src/compose-editor/compose-editor.tsx`（作用域解析）、
  `packages/editor/src/animation-mode`、`packages/preview`（按目标场景取分区）、`e2e/`
- **BREAKING**：`ComposeAnimationFile` 形状与 `animationSchemaVersion` 变化；
  `pages` 规范中「各自绑定**不同**的动画文件」放宽为「MAY 指向同一个文件」。
