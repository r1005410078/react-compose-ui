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

## 三项事实怎么进 Controller

Controller 判定会话需要三件它当前拿不到的事实，都按既有协议以普通数据传入，不引入新端口：

- **连击计数**：`pointer.down` 目前只有 `pointerId / button / point / hit / modifiers`，没有任何双击信息，
  全仓库的 stage 与 stage-engine 也没有 `dblclick` 处理。计数由 surface 按平台惯例归一化后随事件传入，
  而不是让 Controller 自己计时——计时窗口是平台约定，属于 DOM 层知识。
- **可编辑判定**：Controller 不能碰 Registry，所以由 surface 查完 Registry 后以 context 提供判定入口。
  Controller 只知道"能不能编辑"，不知道"编辑哪个 prop"——prop 名称只在提交时用得上，那时执行者是
  surface，让 Controller 知道它属于多余耦合。
- **新建 Entity**：见下一节。

## 创建路径为什么要回灌

Controller 发 `drawing.commit` 时并不创建实体，也不铸 ID——真正 `idFactory()` 铸 ID、`dispatch` 创建
命令的是 surface（`compose-stage.tsx` 的 `createDrawing`）。所以"Controller 提交创建命令后顺手进入编辑"
在协议上做不到：它手里没有新 Entity 的 ID。

选择让 surface 创建完成后把该 Entity 经 context 回灌，Controller 消费一次并发布进入编辑 effect。这保持了
"所有编辑入口都由 Controller 判定"的一致性，代价是一次单向回灌。另一条路是让 surface 自己开启创建后的
编辑会话，改动更小，但编辑入口会分散在 Controller 和 surface 两处，后续加入口时容易只改一边。

回灌必须带**只消费一次**的保护：context 会因文档、选区、viewport 等无关原因反复更新，若不做去重，
同一次创建会重复触发进入编辑。

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
原地编辑应当复用它，不新增测量通道。

但复用不是自动的。`TEXT_RENDERER_MEASUREMENT.measure` 读的是 `props.text`，而这套 props 由
`renderer-measurement.ts` 直接从**文档里的 Entity** 解析（`resolveComposeRendererRuntimeProps({ entity: input.entity })`）。
编辑期间文档按设计不变，所以测量看到的永远是旧文本，宽度不会动。

因此需要在 Registry 上补一条按 Entity 的编辑中值覆盖：宿主把当前编辑文本写进去，Renderer 的运行时
props 和 measurement 的解析输入同时看到它，设置/更新/清除都令 measurement revision 前进并让缓存条目
失效。这条覆盖是纯运行时状态，文档、历史和 Preview 都观察不到。加了它之后，"复用既有失效链路"才
真正成立——覆盖只是把新值送到链路入口，链路本身没变。

这也是编辑必须原地渲染、而不是浮一个 `<input>` 叠加层的原因：叠加层的字形排版与最终渲染不是同一套，
宽度会对不上，所见即所得在编辑瞬间就断了。
