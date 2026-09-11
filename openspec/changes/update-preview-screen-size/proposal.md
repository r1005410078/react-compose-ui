# 变更：预览的屏幕尺寸与取景保真

## 原因

预览对话框把两个互不相干的问题混进了同一个缩放下拉——**「这块屏多大」**与
**「我把它看多大」**。合并的代价是一串保真度缺陷：默认 75% 的 CSS `zoom`（它会在该比例下
**重新布局**，文字度量与换行位置与 100% 不是同一份结果）、强制白底（场景默认背景是
`transparent`，于是画布上是深色、预览里是白色）、12px 圆角把角上的真实内容切掉。
用户因此无从判断自己看到的是不是交付出去的样子。

UE4 的 UMG Designer 把这两件事分给两个控件：右上角的 Screen Size 下拉 + 拖画布边角
（吸附到清单里的分辨率），以及画布自己的缩放。本变更照这条分法重做，并顺带修掉
被它盖住的五条缺陷。

设计稿：`docs/mockups/preview-redesign.html`。

## 变更内容

- **屏幕尺寸**成为对话框的一等控件：清单直接读 core 既有的 `COMPOSE_SCENE_SIZE_PRESETS`
  （与画布尺寸胶囊、Inspector 同一份），第一组是**预览目标自身的尺寸**，另有输入尺寸与
  横竖互换。
- **拖画板右下角即改屏幕尺寸，带吸附**：目标自身尺寸优先于清单预设，容差按**屏幕距离**
  折算，吸附粒度是**整份分辨率**。吸附数学是 core 的纯函数。
- **视图缩放独立**：滚轮 / 按钮 / `Ctrl+0`，「适应窗口」降级为一个**动作**而不是档位。
- **目标种类分流**：新增 `targetKind`，组件目标的默认 `fit` 是 `none`（组件是屏上的零件，
  不该被拉伸填满屏幕），场景是 `contain`；第一组标题与横竖互换项随之变化。
- **`fit` / `alignment` 真正生效**：现有实现只改了盒子的 `max-width` 与 `objectFit`，
  对绝对定位的后代不产生任何缩放——这是对既有规范「the Frame is scaled to fit inside the
  host box」的修复，改用 `transform: scale()`。
- **画板保真**：去掉强制白底、圆角裁切与白色外圈；透明处画棋盘。
- **`COMPOSE_SNAP_RADIUS` 下沉到 core**：`preview` 与 `stage` 之间没有依赖关系，而
  「多近算在上面」在这个产品里只该有一个数——与 `COMPOSE_CURVE_PICK_TOLERANCE` 同一条理由。
- 修掉四条缺陷：场景选择器的名字读错文档、跳转后闪一帧目标错误、页面模式静默压过传入的
  `document`（打开组件按预览看到的是页面）、`__target` 那套针对 `button` 的死 CSS。

## 影响

- 受影响的规范：`compose-preview`
- 受影响的代码：
  - `packages/core/src/frame.ts`（屏幕尺寸吸附、宽高比格式化）、`packages/core/src/index.ts`
  - `packages/preview/src/preview-dialog/*`、`packages/preview/src/compose-preview/*`
  - `packages/stage/src/drafting/use-stage-drafting.ts`（改用 core 的 `COMPOSE_SNAP_RADIUS`）
  - `app/src/StageDemo.tsx`（画布上是哪一份文档，只给一个答案）
- **不在本变更内**：整屏预览形态（`ComposePreviewPage`）、`ComposePreviewSurface` 抽取、
  页面底色选择器。它们各自独立，排在本变更之后。
