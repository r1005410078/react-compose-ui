## ADDED Requirements

### Requirement: 顶层容器标题标签

Stage MUST 为每个顶层容器（`rootIds` 的直接成员、含 Hierarchy 且不是 first-class Group）
在其左上角外侧渲染名称标签。
标签 MUST 使用恒定屏幕尺寸，不随视口缩放放大或缩小，并 MUST 跟随容器的屏幕位置。嵌套容器
MUST NOT 渲染标签。不可见、被宿主隐藏或视口缩放低于可读阈值的容器 MUST NOT 渲染标签。
标签宽度 MUST 不超过容器的屏幕宽度，超出部分 MUST 省略。

标签 MUST 是容器的选中入口：在标签上按下 MUST 与在容器体上按下产生相同的选中与移动语义，
并 MUST 不穿透到下方场景。锁定容器的标签 MUST 只承载名称信息，MUST NOT 接受选中、拖动
或重命名，并 MUST 与未锁定标签有可区分的视觉表现。容器处于选区中时标签 MUST 呈现选中态。变换手柄 MUST 绘制在标签
之上，标签不得遮挡 resize 与 rotate 命中区。

标签 MUST 支持就地重命名：双击进入编辑，Enter 或失焦提交，Escape 取消并恢复原名。Stage
MUST NOT 自行写入文档，重命名结果 MUST 通过受控回调交给宿主；宿主未提供该回调时标签
MUST 只读且不进入编辑态。标签文案与无障碍名称 MUST 走 Stage 内建本地化，不得硬编码。

#### Scenario: 顶层容器显示标签而嵌套容器不显示

- **WHEN** 文档中存在一个顶层容器，其内部还有一个嵌套容器
- **THEN** 只有顶层容器在左上角外侧显示名称标签
- **AND** 平移与缩放视口时标签字号保持不变且始终贴在该容器左上角外侧

#### Scenario: 通过标签选中并移动容器

- **WHEN** 用户在容器标签上按下并拖动
- **THEN** 该容器成为选区并进入 move 手势
- **AND** 标签呈现选中态，变换手柄仍可命中

#### Scenario: 就地重命名容器

- **WHEN** 宿主提供了重命名回调且用户双击标签、输入新名称并按 Enter
- **THEN** Stage 通过回调上报新名称，且不自行提交文档事务
- **WHEN** 用户改为按 Escape
- **THEN** 退出编辑并恢复原名称，不触发回调

#### Scenario: 锁定容器的标签只读且不可选中

- **WHEN** 容器处于锁定状态
- **THEN** 它的标签仍显示名称，但按下不改变选区，双击不进入重命名

#### Scenario: 未提供重命名回调时标签只读

- **WHEN** 宿主未提供重命名回调且用户双击标签
- **THEN** 标签不进入编辑态，仍然只承担选中职责

## MODIFIED Requirements

### Requirement: 直接绘制 Preset

Stage MUST 为 container、rectangle、line、arrow、circle 与 text 提供受控绘制工具。绘制工具 MUST 在拖拽期间展示瞬时预览，正常松手时通过 Registry Preset 创建一个合法 Entity，取消时不得产生文档事务。container 工具在拖拽距离小于有效阈值时 MUST 回退到 Container Preset 的默认尺寸并以按下点为左上角，MUST NOT 创建退化尺寸的容器。

#### Scenario: 拖拽绘制容器与形状

- **WHEN** 用户在任一 container 或 shape 绘制工具中从 surface 拖出有效 bounds 并松手
- **THEN** Stage 创建一个具有相同规范化世界 bounds 的对应 Preset Entity
- **AND** 该 Entity 成为选区，写入一个可撤销事务后请求切换到 select 工具，避免后续点击继续绘制

#### Scenario: 点击绘制容器回退默认尺寸

- **WHEN** 用户使用 container 工具在 surface 上单击而没有产生有效拖拽距离
- **THEN** Stage 以按下点为左上角、按 Container Preset 的默认尺寸创建容器
- **AND** 不创建 1×1 或其他退化尺寸的容器

#### Scenario: 点击或拖拽绘制文字

- **WHEN** 用户使用 text 工具点击 surface
- **THEN** Stage 在点击点创建保留 Text Preset `hug × hug` 轴的文字，初始预览使用 Text 的默认回退尺寸
- **AND** Layout measurement 完成后选区贴合实际文字内容
- **WHEN** 用户使用 text 工具拖拽 surface
- **THEN** Stage 创建两轴为 `fixed` 且使用精确拖拽 bounds 的 text box
- **AND** Escape、pointercancel 或无效 geometry 不创建 Entity
