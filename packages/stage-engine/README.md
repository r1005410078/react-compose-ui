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
const index = createStageSceneIndex(document)
```

SceneIndex 从 `Transform`、`Hierarchy`、`Visibility`、`Lock` 和 `Clip` 派生世界几何、父级、
裁剪命中与选择边界，不读取 Registry。外部拖入查找最深的 `Hierarchy` Entity，未命中时返回
`parentId: null`。Container Resize 只修改自身 Transform，后代局部 Transform 不变。

Move/Resize/Rotate 的命令规划会查询 `TransformConstraints`，并生成带对应操作语义的
`entity.transform.set`。多选、吸附、group/ungroup、reparent 和 duplicate 继续保持单事务与
可逆 Patch 边界。

外部 descriptor 还支持纯数据 `assets` 批次。Engine 只负责会话、世界 drop 点和父级命中，
不读取 Blob、调用 Registry 或依赖资源 UI；异步解析、Preset seed、布局和提交由 Stage 适配层
完成。一个 controller 同时只连接一个 surface，多个编辑器必须创建不同实例。
