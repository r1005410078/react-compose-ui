# @compose-ui/core

React Compose UI 的 React/DOM 无关领域内核。

当前公共文档协议只支持 `ComposeDocument v6`。场景项统一为 `ComposeEntity`，能力由 PascalCase
Component Key 组合，不再存在 Frame/Component 联合类型或节点继承结构。

项目 Component/Variant 不改变该版本：它们使用独立 `Component Asset v1` 文件协议，内部仍保存
一个以 first-class Group 为唯一根的 v6 文档。Core 提供严格解析、显式旧草案迁移、稳定 ID
语义覆盖、继承解析、离线快照和八层深度保护，但不依赖 Asset Provider。

```ts
import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  createTransactionRuntime,
  validateComposeDocument,
  type ComposeDocument,
} from '@compose-ui/core'

const document: ComposeDocument = {
  schemaVersion: 6,
  canvas: createDefaultCanvasSettings(),
  output: createDefaultOutputSettings(),
  rootIds: [],
  entities: {},
}

const validation = validateComposeDocument(document)
if (!validation.valid) console.error(validation.issues)

const runtime = createTransactionRuntime({ document })
runtime.dispatch({
  id: crypto.randomUUID(),
  type: 'entity.name.set',
  payload: { entityId: 'heading', name: '季度销售额' },
  meta: {
    label: '重命名标题',
    source: 'scene-tree',
    targetIds: ['heading'],
  },
})
```

每个场景 Entity 必须拥有 `Composition`、`Transform`、`LayoutItem`、`Visibility`、`Lock`，并至少拥有
`Renderer` 或 `Hierarchy`。`Renderer + Hierarchy` 是合法组合：一个可渲染 Entity 也可以容纳
子项。`Hierarchy.childIds` 是唯一父子事实来源，`rootIds` 保存顶层顺序；Core 校验完整可达、
单父级和无循环。

容器可以额外保存只与 `Hierarchy` 组合的 `Layout`。当前 `ComposeLayout` 只支持 Flex 容器
属性，并提供 `createDefaultComposeFlexLayout()`、`getComposeLayout()` 与
`isValidComposeLayout()`。Layout 使用四边 padding、rowGap/columnGap、direction、wrap 与显式对齐值；
`Hierarchy.childIds` 是唯一 Flow 顺序来源。

`output.backgroundPaint` 是输出画布的结构化背景，支持 `solid`、`linear-gradient`、
`radial-gradient` 与 `angular-gradient`。`output.backgroundColor` 已不属于 v6 协议：文档校验和
`output.configure` 都会拒绝它，不提供兼容别名或自动迁移。

内建 Component 包括：

- `Composition`：Preset、基础 Component Key 与 Capability 归属。
- `Transform`：只保存布局后的 rotation。
- `LayoutItem`：保存 positioning、offset、Fixed/Fill/Hug、min/max、margin 与 alignSelf。
- `GeometryConstraints`：保存移动、Resize 与旋转编辑权限。
- `Visibility`、`Lock`：编辑和渲染状态。
- `Hierarchy`、`Layout`、`Clip`：容器结构、可选 Flex Authoring 数据和裁剪；`Layout`、
  `Clip` 都必须依附 `Hierarchy`。
- `Appearance`：背景、边框、圆角、透明度和阴影。
- `Renderer`：宿主 Renderer type 与严格 JSON props。
- `Bindings`：`rendererProps.fields` 保存顶层字段引用；引用只包含
  `{ scope: 'page', exportName }`。空绑定 Component 非法且应由命令删除。

first-class Group 使用 `presetId: "group"`，固定包含 `Composition + Transform + LayoutItem +
GeometryConstraints + Visibility + Lock + Hierarchy`，不拥有 Renderer、Appearance、Clip 或 Layout。
`createComposeGroupEntitySeed()` 是 Core 与 Stage Engine 共享的唯一 seed 工厂。

未知但合法的 PascalCase Component 会被原样保留。Core 不依赖 Registry；缺失的 Renderer 或
能力定义由上层降级展示，不导致文档被拒绝。

页面资源使用 `ComposePageFile` 聚合 `document` 与可选 `setupScript`。正常解析只接受包装格式；
旧裸 v6 文档通过 `migrateLegacyComposePageFile()` 显式迁移，不维持双格式运行路径。

内建 `entity.*` 命令覆盖 Entity 创建、删除、复制、重命名、层级移动、Component 增删更新，
以及 Transform、Visibility、Lock、Appearance 和 Renderer props 的类型化修改。
Transform 命令带 `move | resize | rotate | set` 操作语义，Core 会同时验证锁定状态和
`GeometryConstraints`，不能绕过 Stage 限制。

所有已提交命令继续生成可逆 Patch 并进入统一 History。选择、展开、工具、Stage viewport 和
临时 Preview Transform 属于会话状态；`canvas`、`output`、Entity 和 Component 数据属于文档。
v5 文档会被明确拒绝；`migrateComposeDocumentV5ToV6()` 提供不修改输入的显式单向迁移，
本包不提供兼容类型、v6→v5 或双运行路径。

`instanceOverrides` 是 `component-instance` 的分层覆盖，只含结构操作。
`resolveComposeInstanceOverrides()` 按顺序应用操作，失败时不返回半应用文档。边界约束（根不可删/移、
基础 Component 不可删、单根）与 Variant 层共用 `applyComposeComponentOverrides()`，单点实现。

组件文档只要求**单根**，根可以是 Group、Container 或任意 Entity：diff 与操作应用都依赖父子两份文档
共享同一根 ID，多根会让锚点失去参照，但根的类型无关紧要。

复合地址 `实例ID/内部ID` 只服务编辑期表示层：段数对应实例嵌套层数而非树深度，因为内部实体 ID 在
组件文档内已唯一。Entity ID 不允许包含分隔符，宿主实体的裸 ID 与内部地址因此可在同一选区集合中区分。
