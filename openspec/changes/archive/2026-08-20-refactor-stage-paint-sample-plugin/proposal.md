# 变更：把图层取色拆成交互插件

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 3 按优先级自上而下的第四刀
（`paint-sample`，1500）。

它是抽取顺序上必须早做的一项：**接管条件是 `context.paintSampling` 存在，与命中类型无关**。
宿主启动取色后画布上任何位置按下都是一次采样，因此它挡在其后所有按命中判定的插件之前——
`path`(1400)、`paint`(1300)、`segment-resize`(1200) 等都不可能先于它抽取，否则取色态下点在
路径柄上会被判成路径拖拽。

## 变更内容

- 新增 `paint-sample-plugin.ts`，优先级 1500 取自 `STAGE_GESTURE_PRIORITY`。
- `samplePaintAt` 与 `hasSampleableBackgroundPaint` 随插件迁出 controller，并从依赖闭包
  `context`/`index` 改为显式参数，成为可独立测试的纯函数。
- 会话实现 `isCompatibleWith`：采样目标（Entity 或字段）变化即结束会话，替代内核里原本
  基于 `gesture.type === 'paint-sample'` 的枚举判定。
- legacy 删除全部 paint-sample 分支：claim、update、finish、`Gesture` 联合变体、
  并发中止判定分支，以及两个私有 helper。

## 影响

- 受影响的规范：`stage-engine`（基于图层的安全降级取色：明确由独立插件承担）
- 受影响的代码：`interaction-kernel/paint-sample-plugin.ts`（新增）、
  `interaction-kernel/index.ts`、`interaction-controller.ts`
