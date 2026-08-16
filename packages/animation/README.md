# @compose-ui/animation

React 与 DOM 无关的 ComposeDocument 场景动画领域模型：`Animation` ECS Component 协议、
插值与采样器、运动路径几何、数据校验与全部动画命令。只依赖 `@compose-ui/core`。

## 数据放在哪

动画被拆成两半，各自放在它真正归属的地方：

- **动画清单**在 `ComposeDocument.animations`（由 core 定义），每条只有
  `{ id, name, durationMs, playbackMode, bindings? }`。时长与播放模式是文档级事实，
  挂不到任何单个 Entity 上。
- **关键帧轨道**在被动画 Entity 的 `Animation` Component 上，按动画 ID 分组。

轨道跟着 Entity 走不是为了省事，而是为了结构操作的正确性：复制粘贴 Entity 时动画自动跟随，
删除 Entity 时动画自动消失且撤销可恢复，Group 与提取项目组件都不需要搬迁轨道，
组件实例还能通过既有的 `instanceOverrides` 代数自带动画。

```ts
import {
  applyComposeAnimationAtTime,
  createComposeAnimationCommandHandlers,
} from '@compose-ui/animation'

const runtime = createTransactionRuntime({
  document,
  handlers: createComposeAnimationCommandHandlers(),
})

// 渲染时把动画在某一时刻套用到文档上；未被命中的 Entity 保持原引用。
const framed = applyComposeAnimationAtTime(runtime.document, 'intro', 150)
```

## 校验需要宿主主动调用

**core 不认识 `Animation` Component。** `validateComposeDocument` 对未知 Component 只检查
key 是 PascalCase、value 是合法 JSON，因此轨道级校验不会在文档加载时自动发生，需要宿主在
加载后调用 `collectComposeAnimationIssues(document)`。

这是把轨道挂在 Entity 上换来的代价。为了不让它变成崩溃源，命令 handler 始终校验自己的输入，
采样器对坏数据静默跳过而不是抛错——未调用校验入口只会让坏数据无声地不生效。

## 插值与运动路径

插值挂在关键帧的**出向段**（与 Rive 一致）：`hold` 保持前值、`linear` 线性、
`cubic` 按标准 CSS `cubic-bezier(x1, y1, x2, y2)` 重映射时间。播放头超出首尾关键帧时钳制到
端点值，不做外推。

位置用一条 `vector2` 轨道而不是 x / y 两条标量轨道，因为运动路径的空间切线是二维量，
必须和位置值挂在同一个关键帧上。`sampleComposeMotionPath` 把这条轨道求值为顶点、切线端点、
按弧长细分的折线，以及按时间等分的采样点——后者的疏密体现速度快慢，与折线是两套点集。

颜色在 sRGB 分量上线性混合（含 alpha）。任一端是 `transparent` 时从对侧借用 RGB 只改 alpha，
避免红色淡出先变黑再消失。
