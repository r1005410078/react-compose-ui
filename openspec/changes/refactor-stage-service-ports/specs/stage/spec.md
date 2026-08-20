## ADDED Requirements

### Requirement: Stage 注入面聚合

`ComposeStageProps` MUST 把宿主注入面收敛为 `services` 与 `policy` 两个聚合对象。
`services` MUST 承载宿主拥有的能力端口（`dispatch`、`registry`、`assetResolver`、
`pageLoader`、`scriptModuleLoader`、`clipboard`、`onClipboardChange`、`layoutRuntime`）。
Stage MUST 按字段消费 `services`，MUST NOT 以其对象引用作为场景子树或 measurement adapter
的缓存键。`policy` MUST 承载宿主拥有事实来源、Stage 只消费的开关（`marqueeMode`、
`lockGestureParent`、`gridVisible`），Stage MUST NOT 为其中任何一项持有事实来源或提供切换 UI。

受控协议（`viewport`、`tool`、`selectedIds`、`activeFrameId` 及其 `onChange`）、逐帧数据
（`document`、`layoutSnapshot`、`layoutPreviewSnapshot`、`layoutError`、`scriptScope`）与
快捷键（`shortcuts`、`onShortcutAction`）MUST 保持平铺。上述聚合项的同名平铺 prop
MUST 被删除，且 MUST NOT 提供兼容别名或运行时迁移层。

#### Scenario: 端口经 services 注入

- **WHEN** 宿主通过 `services` 注入 `assetResolver` 与 `pageLoader` 并渲染 Stage
- **THEN** 资源节点创建与页面实体渲染的行为与聚合前完全一致
- **AND** 省略某个可选端口时该端口对应能力呈现既有的缺省状态

#### Scenario: 模式语义经 policy 注入

- **WHEN** 宿主传入 `policy.lockGestureParent` 为 true 并在画布上拖动一个对象
- **THEN** 拖动不产生跨父级挂载，同容器重排照常
- **AND** 该行为与聚合前的平铺 `lockGestureParent` 逐项一致

#### Scenario: 端口按字段消费

- **WHEN** 宿主重新构造 `services` 对象但其中各端口的值未变
- **THEN** Stage MUST NOT 因此重建场景子树、重建 measurement adapter 或重置进行中的交互会话

#### Scenario: policy 变化不牵动端口

- **WHEN** 宿主因模式切换更新 `policy` 而 `services` 各端口未变
- **THEN** Stage MUST NOT 因此重建场景子树或重置进行中的交互会话

## MODIFIED Requirements

### Requirement: 选择与框选

select 工具 MUST 支持点击选择、Shift 切换多选、点击空白清除选择和空白拖动 marquee。marquee
工具 MUST 支持从任意位置（含节点之上）拖出 marquee。两个工具的框选 MUST 使用同一个受控
`policy.marqueeMode`，Stage MUST 只消费该值而不得自行持有模式的事实来源——Stage 本身不提供
切换模式的 UI。选择结果 MUST 使用稳定文档 ID，并 MUST 忽略 hidden 节点和完全位于其他 Frame
剪裁范围之外的内容。

#### Scenario: 点击与 Shift 多选

- **WHEN** 用户点击一个可见节点，再 Shift 点击另一个可见节点
- **THEN** Stage 请求按交互顺序包含两个 ID 的选择
- **AND** SVG Overlay 显示对应单选或共同世界包围框

#### Scenario: 框选节点

- **WHEN** 用户从 Stage 空白处拖出 marquee
- **THEN** 按当前 `policy.marqueeMode` 命中的可见未锁定节点按确定性场景顺序进入选择
- **AND** marquee 只作为瞬时 SVG Overlay，不产生文档事务

#### Scenario: 使用框选工具从节点上起框

- **WHEN** 工具为 marquee 且用户在一个可见节点上按下并拖动
- **THEN** Stage 显示 marquee Overlay 而不是移动该节点
- **AND** 释放后按当前 `policy.marqueeMode` 请求选择

#### Scenario: Overlay 区分判定模式

- **WHEN** 当前生效判定为包含
- **THEN** marquee Overlay 使用实线边框
- **AND** 当前生效判定为相交时使用虚线边框

#### Scenario: 点击空白清选

- **WHEN** select 工具下用户点击未命中 Frame 内容或节点的空白
- **THEN** Stage 请求空选择
- **AND** 文档与 activeFrameId 保持不变

### Requirement: Stage 复制剪切粘贴

Stage MUST 为当前画布选区提供复制、剪切和粘贴。复制 MUST 把规范化顶层 Entity 写入会话剪贴板且
不修改文档；剪切 MUST 只纳入未锁定来源，并在成功粘贴移动后清空剪贴板。粘贴 MUST 使用建议落点：
可容纳子项的未锁定容器追加子项，叶节点插到自身之后，空白画布落到根级。Stage MUST NOT 读写系统
剪贴板。未注入 `services.clipboard` 的独立 Stage 使用内建内存剪贴板；宿主提供 `onShortcutAction`
并返回 `true` 时 MUST 停止内建处理。可编辑输入或画布内文字编辑中 MUST NOT 拦截平台复制/剪切/粘贴。

#### Scenario: 从画布菜单复制并粘贴

- **WHEN** 用户右键可见节点并执行复制，再在空白画布执行粘贴
- **THEN** Stage 提交一次复制事务，新节点位于根级并被选中
- **AND** 再次粘贴仍可生成另一组副本

#### Scenario: 剪切后粘贴清空剪贴板

- **WHEN** 用户剪切有效选择并粘贴到建议落点
- **THEN** 来源被移动到新位置且剪贴板被清空
- **AND** 再次粘贴不产生事务

#### Scenario: 使用平台主修饰键

- **WHEN** Stage 聚焦且用户按下默认 Primary+C / Primary+X / Primary+V
- **THEN** Stage 分别执行复制、剪切和粘贴
- **AND** 右键菜单在 macOS 显示 ⌘C/⌘X/⌘V，其他平台显示 Ctrl+C/Ctrl+X/Ctrl+V
- **AND** 裸 `C` 仍切换容器绘制工具

#### Scenario: 可编辑目标保留系统剪贴板

- **WHEN** 焦点位于 input、textarea 或画布内文字编辑
- **THEN** Primary+C/X/V 不执行 Entity 复制、剪切或粘贴

#### Scenario: 宿主经 services 提供共享剪贴板

- **WHEN** 宿主通过 `services.clipboard` 注入共享快照并执行复制
- **THEN** 写入经 `services.onClipboardChange` 通知宿主
- **AND** 粘贴可用性与聚合前的平铺 `clipboard` 行为一致
