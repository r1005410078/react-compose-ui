# 变更：世界坐标轴与原点标记可关

## 原因

画布上有两条贯穿全图的世界坐标轴（品红横线、黄绿竖线）加一个 16×16 的原点标记，它们**永远
显示、没有任何开关**。它们在屏幕上与十字光标难以区分——都是贯穿图面的亮线，而十字光标只在
取点时出现、坐标轴一直在。实机排查中，同一位用户三次把坐标轴误认成十字光标，并据此报了三次
「样式没生效」「臂长没变」。

坐标轴回答的是「世界原点在哪」。这个问题在**接线图上极少被问到**——用户对齐的是符号的端子，
不是世界原点；而它的答案却占着两条横贯全屏的亮线。

## 变更内容

- `ComposeEditorPreferences` 增加 `showWorldAxes: boolean`，默认 `true`（保持现状），
  规范化时缺席或非布尔回落 `true`。
- 设置 › 画布 新增「世界坐标轴」一节：一个勾选，说明它同时管两条轴线与原点标记。
- `ComposeStagePolicy` 增加 `worldAxes?: boolean`（默认 `true`），关闭时 `StageWorldUnderlay`
  **既不画轴线也不画原点标记**——两者回答同一个问题，只关一半会留下一个孤零零的小十字，
  比两者都在更费解。网格与场景边界描边不受影响：它们回答的是别的问题。
- **做成用户偏好而不是工作区会话开关**：用户刚刚要求三个工作区的画布表现一致，再加一个按
  工作区分叉的开关会重演同一个困惑。它与十字光标样式同一档，因此住在同一个设置分类里。

## 影响

- 受影响的规范：`stage`（原点标记与坐标轴那条 MUST 增加可关闭）、`editor-preferences`
  （新增偏好、设置分类多一节）。
- 受影响的代码：`packages/stage/src/types.ts`、
  `packages/stage/src/stage-surface/screen-model/stage-world-underlay.tsx`、
  `packages/stage/src/stage-surface/compose-stage.tsx`、
  `packages/editor/src/editor-preferences/*`、
  `packages/editor/src/editor-controller/controller.tsx`、
  `packages/editor/src/compose-editor/compose-editor.tsx`、`packages/editor/src/editor-i18n.ts`。
