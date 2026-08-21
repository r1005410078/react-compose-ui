# 变更：补上插件抽取过程中失效的两道守卫

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 3 的两处安全网各有一个洞，都是在
抽取过程中静默产生的，`path`(1400) 落地前必须先补上——否则同一个洞会被复制到下一个插件。

**一、旋转丢了并发中止。** 基线规范「手势预览与原子提交」明确要求「并发的文档或布局变化
MUST 中止引用 Entity 的空间手势（移动、缩放、**旋转**、端点、Paint）」。抽取前这条由内核的
`spatialGesture = gesture.type !== 'draw'` 统一保证；抽取后改由会话自报，而 rotate 的
`isCompatibleWith` 只比了选区——注释写着「文档或布局一变……」，代码里没有这两项。已用临时用例
确认：旋转进行中替换 `document`，手势仍停在 `rotate` phase。

危害不在交互期而在落库：旋转的 `center`、`bounds`、`baseRotation` 都是按下当刻算好的冻结量。
别处的编辑挪动了目标，预览照常跟着指针转，提交的却是绕着过期中心算出来的角度——错误不显形。

**二、抽取顺序不变量的守卫已经过期。** `extraction-order.test.ts` 里的「已抽取集合」是手抄的
字面量，停在 `text-edit-guard` 与 `pan` 两项，rotate 与 paint-sample 落地时没人更新。这道守卫
正是为了防住 pan 抽取那次真实反转而立的，现在它看着还在、其实早已不检查新插件。

## 变更内容

- 新增 `spatial-baseline.ts`：`captureStageSpatialBaseline(context)` 在 claim 当刻捕获
  `document` / `layoutSnapshot.revision` / `tool`，返回判定基线是否仍成立的谓词。与「上一份
  context」比较等价——任何一项变化都会立即中止会话，所以只要会话还活着，这三项自 claim 起就没变过。
- rotate 的 `isCompatibleWith` 先过空间基线，再比选区。
- paint-sample **刻意**不接基线，并在代码里写明原因：它不冻结任何几何，每帧从当前 document
  重新求值，绑上文档恒等只会让无关编辑白白打断取色。
- 新增 `extracted-plugins.ts`：`STAGE_EXTRACTED_PLUGIN_FACTORIES` 成为已抽取插件的唯一登记处，
  controller 与顺序不变量测试共用它，新增插件不可能只改一处。
- 补一条断言：每个已抽取插件都必须在优先级表里登记且优先级一致——少了它，一个表外的 id 会让
  前缀断言在空前缀上空转通过。

## 影响

- 受影响的规范：`stage-engine`（会话自检上下文兼容性、Stage 交互插件仲裁）
- 受影响的代码：`interaction-kernel/spatial-baseline.ts`（新增）、
  `interaction-kernel/extracted-plugins.ts`（新增）、`interaction-kernel/rotate-plugin.ts`、
  `interaction-kernel/paint-sample-plugin.ts`（仅注释）、`interaction-kernel/index.ts`、
  `interaction-controller.ts`
- 用户可见行为：旋转期间发生并发文档或布局变化时手势中止，与移动/缩放一致——这正是基线规范
  原本就要求的行为
