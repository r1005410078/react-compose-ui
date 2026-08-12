# @compose-ui/stage-engine

React 与 DOM 无关的 Stage 坐标、ECS 场景查询、吸附、滚动映射、空间命令和 Pointer 交互
controller。React surface、Entity Registry、主题与国际化由 `@compose-ui/stage` 适配。

```ts
import {
  createStageInteractionController,
  createStageSceneIndex,
  type StageViewport,
} from '@compose-ui/stage-engine'

const viewport: StageViewport = { x: 0, y: 0, zoom: 1 }
const controller = createStageInteractionController()
const index = createStageSceneIndex(document, layoutSnapshot)
```

SceneIndex 从正式 `ComposeLayoutSnapshot`、Transform rotation、`Hierarchy`、`Visibility`、`Lock`
和 `Clip` 派生世界几何、父级、
裁剪命中与选择边界，不读取 Registry。外部拖入查找最深的 `Hierarchy` Entity，未命中时返回
`parentId: null`。Container Resize 只修改自身 Transform，后代局部 Transform 不变。

Move/Resize/Rotate 的命令规划会查询 `GeometryConstraints`，并生成带对应操作语义的
`entity.transform.set`。多选、吸附、group/ungroup、reparent 和 duplicate 继续保持单事务与
可逆 Patch 边界。

Group 现在是 first-class 结构节点：只接受两个或更多同父级、Absolute、未锁定的顶层规范化选区；
持久化 frame 提供稳定局部坐标系，命中、框选与吸附范围则实时取可见后代并集。Ungroup 只允许
first-class Group 和严格匹配的历史透明 Group，普通 Container 会返回稳定禁用原因。

`createComponentExtractionPlan()` 可把一个或多个合法场景根克隆为透明 Group 单根组件文档，保持
世界几何、旋转和 sibling 顺序。`createReplaceSelectionWithEntityCommand()` 只负责资源写入后的
原子场景替换与 Undo/Redo；Engine 不执行 Provider 副作用。

手势开始时会冻结 Layout Snapshot。移动 Flow 会以已求解 box 预览，并在松手时原子转换为
Absolute；其中 Fill 轴会烘焙为 Fixed。Resize Fill 只转换实际改变的轴，Rotation 不改变 Flow
或 sizing。Scene Tree reparent 移入 Layout 自动 Flow，移出自由父级烘焙 Absolute；同父级排序
只更新 `Hierarchy.childIds`。Flow 目标的 Group/Ungroup 通过公共 availability API 返回稳定禁用原因。

Paint 编辑也在 controller 内作为独立、无 DOM session 运行。`paintEditing` 只在单选 Entity 的
Inspector 打开 `backgroundPaint` 时产生 Linear/Radial/Angular 的世界坐标控制柄；拖动只更新 snapshot
preview，`pointerup` 才提交一次 `entity.appearance.set`。`paintSampling` 按 SceneIndex 的可见 z-order 与
裁剪命中取得结构化 Paint：普通点击写入点击处解析的纯色，Alt/Option 点击可复制完整背景 Paint。
图片、SVG 和未知 Renderer 没有 headless 像素采样协议，因此会明确返回 unavailable。

外部 descriptor 还支持纯数据 `assets` 批次。Engine 只负责会话、世界 drop 点和父级命中，
不读取 Blob、调用 Registry 或依赖资源 UI；异步解析、Preset seed、布局和提交由 Stage 适配层
完成。一个 controller 同时只连接一个 surface，多个编辑器必须创建不同实例。
