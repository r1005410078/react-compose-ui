# 变更：Component 字段绑定页面 setup value

## Why

当前只有 Renderer Props 能绑定页面 setup 返回的成员（`Bindings.version: 1`）。内建与第三方
Component 的 authored 字段无法由业务状态驱动，实施工程师只能回到宿主代码里命令式地改属性。

后续的属性动画提案需要把 `Animation.play` 绑定到 setup 返回的 boolean，但"Component 字段可绑定"
本身是与动画无关的通用能力，因此独立成一个变更先行落地。

## What Changes

- 扩展 `Bindings` 为兼容 v1/v2 的协议：v2 允许可选 `rendererProps` 与 `componentFields`，后者把
  Component Key 与稳定 Field 名称映射到 `{ scope: 'page', exportName }`。
- Component Definition 可以声明稳定的 value Field Contract、显示名、authored getter 与纯同步
  validator；Registry 提供与 Renderer Props 对称的 runtime 值解析、诊断与页面 scope 订阅。
- Registry React bridge 向声明了 Contract 的 Component Inspector 提供 binding port（兼容变量列表、
  当前引用、状态、绑定/换绑/解绑意图），Inspector 不需要读取 Editor 内部状态或直接改 Bindings JSON。
- Editor 复用既有 Renderer 绑定入口的交互语义，把 Component 字段绑定接到同一套 Inspector 端口上。

## Impact

- 受影响的规范：`compose-document`、`component-registry`
- 受影响的代码：`packages/core` Bindings 校验与序列化、`packages/component-registry` 运行时值解析与
  React bridge、`packages/editor` Inspector binding 命令
- 兼容性：ComposeDocument 仍为 v6；旧 `Bindings.version: 1` 文档原样解析，不做加载时迁移。只有首次
  保存 Component 字段绑定时才把该 Entity 的 Bindings 规范化写成 version 2。
- 本变更不引入任何动画语义，也不新增包。

## User Stories

### US-01：把 Component 字段绑定到 setup 变量

作为实施工程师，我希望在 Component Inspector 里把一个 authored 字段绑定到页面 setup 返回的变量，
从而让业务状态直接驱动该字段，而不需要在宿主代码里手写同步逻辑。

验收要点：

- Inspector 只列出与 Field Contract 兼容的 value export，method export 不进入候选。
- 绑定与解绑各产生一个可逆文档事务，authored 值保持原样并在解绑后重新生效。
- 文档只保存 `{ scope: 'page', exportName }`，不保存变量当前值。

### US-02：绑定失效时确定性回退

作为实施工程师，我希望在 export 缺失、类型不匹配或 validator 拒绝时，字段回退到 authored 值并给出
可定位的诊断，而不是让整个 Entity 或其他绑定一起失效。

验收要点：

- getter/validator 抛错被隔离，不影响同一 Entity 上其他 Renderer Prop 与 Component Field。
- 诊断能定位到 Entity、Component Key 与 Field 名称。
- 未声明 Contract 的 Component 保持原有 authored JSON 与 Inspector 行为。
