# 变更：把可编辑路径手柄拖拽拆成交互插件

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 3 按优先级自上而下的第五刀
（`path`，1400）。它是第一个**在中断时必须主动向宿主发效果**的会话：路径几何住在宿主的本地
预览里，引擎既不产 Patch 也不缓存几何，因此手势被打断时若不显式发一次 `path.change`
`phase: 'cancel'`，宿主的预览就永远停在半途。

抽取前这条中断通知挂在 legacy 的 `reset()` 里——那是 legacy 中止手势的唯一漏斗，却有一半
调用点在指针生命周期之外。会话化之后它落到 `cancel(ctx)`，由会话自己还原自己发布过的东西。

## 变更内容

- 新增 `path-plugin.ts`，优先级 1400 取自 `STAGE_GESTURE_PRIORITY`，登记进
  `STAGE_EXTRACTED_PLUGIN_FACTORIES`。
- 三个阶段（start / move / end）与中断（cancel）的载荷只差 `phase`，集中拼装避免字段漏写。
- `cancel(ctx)` 承接 `reset()` 里的路径中断通知，载荷取会话推进到的最新点。
- `isCompatibleWith` 兼顾两项：宿主换掉正在编辑的路径即结束；起点世界坐标是按下当刻冻结的，
  因此还要过 `captureStageSpatialBaseline`（并发文档或布局变化中止）。
- legacy 删除全部 path 分支：claim、update、finish、`Gesture` 联合变体、`reset()` 中断通知、
  并发中止判定分支，以及 rotate 抽走后遗留在 claim 处的一段悬空注释。

## 影响

- 受影响的规范：`stage-engine`（可编辑路径手势）
- 受影响的代码：`interaction-kernel/path-plugin.ts`（新增）、
  `interaction-kernel/extracted-plugins.ts`、`interaction-kernel/index.ts`、
  `interaction-controller.ts`
