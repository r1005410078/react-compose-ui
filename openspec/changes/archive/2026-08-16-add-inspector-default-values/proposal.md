# 变更：Inspector 提供属性重置基线

## 原因

Property Panel 的行级重置动作与“已修改”筛选都依赖受控 `defaultValue` prop：`hasDefaultValue`
仅由 `defaultValue !== undefined && safeParse(schema, defaultValue).success` 推导，为 false 时
重置动作恒为 `null`。当前第一方 Inspector 几乎都只传 `schema` + `value`：

- `packages/materials` 的内建 Component Inspector（Appearance、几何、Visibility、Lock、Hierarchy）
  与 Renderer Inspector 均未传 `defaultValue`。
- `packages/editor` 的 Canvas Inspector 传的是 `defaultValue={value}`，基线随当前值漂移，
  `deepEqual(value, baseline)` 恒为真，等价于没传。

结果是用户修改背景填充、尺寸、透明度等属性后，右侧操作列始终空白，没有重置入口，
“只看已修改”筛选也永远为空。这不是 Property Panel 的缺陷，而是宿主未提供重置基线。

## 变更内容

- 内建 Component Inspector MUST 由 Component Definition 的默认 Component 值派生稳定
  `defaultValue`，并传给 `ComposePropertyPanel`。基线只依赖 schema 与定义，不得依赖当前
  受控 value，也不得随每次渲染重建引用。
- Appearance Inspector 的基线使用结构化 Appearance 默认值（Solid `backgroundPaint`、
  `borderWidth: 0`、`borderRadius: 0`、`opacity: 1` 等），且 MUST 能通过 Inspector 自身 schema
  的校验，否则重置动作仍会被第二个条件挡掉。
- 几何 Inspector 的基线来自 LayoutItem 与 Transform 的默认值（`rotation: 0`、`margin: 0`、
  默认 alignSelf）；位置与尺寸没有与实例无关的默认值，MUST 不参与重置基线。
- Renderer Inspector 的基线来自 Renderer Definition 的默认 props；schema 未覆盖的宿主字段
  不进入基线，重置也不得删除它们。
- Canvas Inspector 改为使用与当前 value 无关的固定输出默认值（默认输出尺寸与默认背景 Paint），
  修正 `defaultValue={value}` 造成的重置永不可用。
- 公共协议扩展：Component Definition 与 Renderer Definition MUST 能向 Inspector 暴露其默认值，
  供 Inspector 构造基线；宿主自定义 Inspector 可选择不提供基线，此时行为与今天一致。

## 影响

- 受影响的规范：`basic-materials`、`editor-workspace-layout`
- 受影响的代码：`packages/materials/src/material-inspector-kit`、
  `packages/editor/src/inspector/canvas-inspector.tsx`、相关 Component/Renderer Definition
- 无破坏性变更：`ComposePropertyPanel` 公共 API 不变，未提供基线的宿主 Inspector 行为不变
- 文档同步：`packages/property-panel/README.md` 说明重置动作依赖宿主提供稳定 `defaultValue`
