# @compose-ui/stage-engine

`@compose-ui/stage-engine` 提供 React 与 DOM 无关的 Stage 坐标、场景索引、吸附、滚动映射、
空间命令和 Pointer 交互 controller。React surface、组件 registry、主题与国际化由
`@compose-ui/stage` 适配。

```ts
import {
  createStageInteractionController,
  createStageSceneIndex,
  type StageViewport,
} from '@compose-ui/stage-engine'

const viewport: StageViewport = { x: 0, y: 0, zoom: 1 }
const controller = createStageInteractionController()
const index = createStageSceneIndex(document)
```

一个 controller 同时只连接一个 surface。多个编辑器或 Stage 必须创建不同实例。

SceneIndex 支持隐式 Canvas 下的任意根、嵌套旋转 Frame、裁剪祖先命中和选择派生的最近 Frame。
外部拖入未命中 Frame 时返回 `parentId: null`。`createReparentCommand` 同样接受 nullable parent，
group/ungroup 以透明且不裁剪的 Frame 保持世界几何；Frame resize 只更新 Frame 自身 transform。
