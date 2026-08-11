# 设计说明

## 为什么编辑契约必须放在 Registry

Stage 需要知道两件事：某个 Entity 能不能原地编辑文字、文字存在哪个 prop 里。最直接的写法是
`renderer.type === 'text'`，但架构边界明确禁止：`stage` 可以依赖 `component-registry`，不得依赖
`materials`。硬编码物料类型会让 Stage 反向知道具体物料，也会让宿主自定义的文字类 Renderer 永远
无法获得原地编辑。

因此在 `ComposeRendererDefinition` 上增加可选声明，指明承载文本的 value prop 名称。Registry 在注册时
校验该 prop 已声明为 value contract，校验失败按既有 Definition 拒绝路径处理。Stage 只问 Registry
"这个 Entity 可不可编辑、编辑哪个 prop"，物料只负责声明与渲染。

## 编辑状态的归属

`paintEditing` 是既有的模态编辑先例，但它由 Inspector 驱动、以 context 输入的形式传给 Controller。
文字编辑的**入口在画布内部**（工具点击、双击、Enter），所以两者不能完全照搬。

采用与受控选择一致的模型：Controller 判定进入/退出并发布 effect，宿主持有 `textEditing` 状态并作为
context 回传。这样 Controller 保持无 DOM、无状态外溢，宿主仍是唯一事实来源，同时 Preview 等其他
消费方不会被动继承编辑态。

Controller 不持有文本内容。输入过程中的中间文本是 DOM 层的瞬时状态，只有退出编辑时才由宿主发一次
命令。让 Controller 逐字符持有文本会把每次按键变成一次状态机事件，既无必要也会污染手势原子性。

## 提交为什么必须是单条事务

逐字符提交会让历史面板被单个单词撑满，`Ctrl+Z` 也退化成逐字符回退。因此编辑期间不产生任何事务，
退出时按三种情况收敛：

- 内容有变化 → 一条 `entity.renderer.props.set`
- 内容为空 → 一条 `entity.delete`
- 内容未变化 → 不发命令

这同时解决了"点击创建后立刻按 Esc"的场景：创建本身已是一条事务，空内容删除是第二条。首期接受
这两条独立事务，不做合并——合并需要跨手势改写历史，代价与收益不成比例。

## 编辑态为什么要屏蔽手势

编辑态下拖拽的语义是选择文本，不是移动实体。若仍保留移动/缩放手势，用户在文字上拖选会把实体拖走。
因此编辑期间该 Entity 的移动、缩放、旋转手柄与框选一并屏蔽，覆盖层只保留一个编辑边框。

八向手柄的抑制条件是"处于编辑态"，与既有的 TransformConstraints 抑制是两条独立规则，叠加生效。

## Auto width 的实时增长

Auto width 文字在输入时宽度必须实时跟随。Text 已有 Hug measurement 与 measurement revision 失效链路，
原地编辑只要让编辑中的文本参与同一条链路即可，不需要新的测量通道。这也是编辑必须原地渲染、而不是
浮一个 `<input>` 叠加层的原因：叠加层的字形排版与最终渲染不是同一套，宽度会对不上，所见即所得在
编辑瞬间就断了。
