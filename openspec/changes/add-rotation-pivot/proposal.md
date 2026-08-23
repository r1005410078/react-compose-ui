# 旋转基点

## Why

画出来的刀闸**还不会动**。角度轨道、动画模式自动记录、脚本驱动播放三段今天都已经在跑
（`['Transform','rotation']` / `auto-record.ts` / `use-animation-playback.ts`），唯独旋转绕的是
**盒中心**——`stage-geometry.ts` 的实体矩阵是 `rotate ∘ translate(−盒中心)`。

刀片绕**铰点**转，铰点在刀身一端。基点不解决，用户刻出来的每一帧角度都对，画面上刀片却在
原地打转而不是绕轴摆动，而这个错误在数据里完全看不出来——只有盯着画面才发现。

这是「画 → 动 → 脚本驱动」这条纵向流程唯一还缺的一环。做完它，后面每一刀都能拿一条真实
可跑的流程验证，而不是等到最后才第一次知道整条路通不通。

## What Changes

- **`core`**：`ComposeTransform` 增加**可选** `pivot`（归一化盒坐标），缺席即盒中心。
  协议版本不变，无迁移，既有文档渲染逐像素不变。
- **`stage-engine`**：`matrixFromTransform` 与 `decomposeMatrix` 这对互逆函数同时接基点，
  `width / 2` 变成 `width * pivot.x`。约十处调用点全部在本包内。
- **`component-registry`**：`composeEntitySceneStyle` 的 `transformOrigin` 由基点算出。
  Stage、Preview、组件实例三条渲染路径共用这一个函数，因此是一处改动覆盖三处。
- **`materials`**：几何 Inspector 增加「旋转基点」字段，v1 是**九点选择器**
  （`v.picklist`，零新 editor）；文档字段仍是自由 vector2，将来加自定义数值不动协议。
- **顺带**：`rotate-plugin` 的点选逻辑改读 `resolveStageClickSelection`——它现在自己内联了
  一份 Shift 切换，是「点选与框选读同一张表」这条不变量的漏网之鱼。

**不做**（各有理由，见 design）：基点关键帧、画布上的基点手柄、多选公共基点。

## Impact

- Affected specs: `compose-document`、`stage-engine`、`component-registry`、`basic-materials`
- Affected code: `packages/core/src/document-types.ts`、`packages/core/src/entity.ts`、
  `packages/core/src/document.ts`、`packages/stage-engine/src/geometry/stage-geometry.ts`、
  `packages/stage-engine/src/gesture-planning/`、`packages/stage-engine/src/commands/`、
  `packages/component-registry/src/registry-renderers/entity-scene-style.ts`、
  `packages/materials/src/material-inspector-kit/component-inspectors.tsx`
- 协议版本不变；**默认值必须是盒中心**，否则所有既有文档的旋转会集体改变——这是本刀的硬约束。
