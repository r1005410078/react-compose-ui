## ADDED Requirements

### Requirement: Stage 复制剪切粘贴

Stage MUST 为当前画布选区提供复制、剪切和粘贴。复制 MUST 把规范化顶层 Entity 写入会话剪贴板且
不修改文档；剪切 MUST 只纳入未锁定来源，并在成功粘贴移动后清空剪贴板。粘贴 MUST 使用建议落点：
可容纳子项的未锁定容器追加子项，叶节点插到自身之后，空白画布落到根级。Stage MUST NOT 读写系统
剪贴板。独立 Stage 使用内建内存剪贴板；宿主提供 `onShortcutAction` 并返回 `true` 时 MUST 停止内建
处理。可编辑输入或画布内文字编辑中 MUST NOT 拦截平台复制/剪切/粘贴。

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

## MODIFIED Requirements

### Requirement: 可配置 Stage 快捷键

Stage MUST 接受可选 locale 与快捷键配置，并在未提供时保持 zh-CN 和现有默认键位。默认动作
MUST 包括临时平移、select/pan 工具、适配选择/Frame、100%/放大/缩小、grid/smart snap、
duplicate、copy/cut/paste、group/ungroup 和 delete；动作只通过现有会话回调或 dispatch 边界生效。

#### Scenario: 执行默认 Stage 快捷键

- **WHEN** Stage 聚焦且用户使用默认 V/H、F/Shift+F、primary+0/Equal/Minus、Shift+G/S 或编辑命令键位
- **THEN** Stage 执行对应工具、适配、缩放、吸附或文档命令
- **AND** 会话动作不产生文档事务，编辑动作仍只产生既有事务

#### Scenario: 执行自定义临时平移键

- **WHEN** 宿主把临时平移动作绑定到非 Space 键并按住该键拖动
- **THEN** Stage 使用新键临时平移 viewport
- **AND** Space 不再触发该动作

#### Scenario: 忽略可编辑与组合输入

- **WHEN** 键盘事件来自可编辑元素或处于 IME composing
- **THEN** Stage 不执行导航、工具、适配、吸附或临时平移快捷键
- **AND** 现有文本编辑行为保持不变

### Requirement: ECS 上下文菜单与结构操作

Stage 上下文菜单 MUST 根据 Hierarchy、Lock 与 TransformConstraints 计算 copy、cut、paste、
duplicate、group、ungroup、delete 和视图操作状态，不得读取旧 kind。

#### Scenario: 取消容器分组

- **WHEN** 单选含子项的可编辑 Hierarchy Entity
- **THEN** 菜单启用取消编组并保留现有快捷键提示

### Requirement: Stage 右键操作菜单

Stage MUST 在节点和空白画布使用共享右键菜单呈现编辑、视图、工具和吸附操作。编辑区 MUST 在
创建副本之前显示复制、剪切和粘贴。

#### Scenario: 右键未选节点

- **WHEN** 用户右键未选中的可见节点
- **THEN** Stage 先请求单选该节点并显示适用编辑操作

#### Scenario: 右键菜单显示当前 Stage 键位

- **WHEN** Stage 打开节点、视图、工具或吸附菜单
- **THEN** 每个实际配置的动作在菜单末尾显示当前 `shortcuts` 的全部键位
- **AND** 自定义配置立即生效，空数组隐藏提示，禁用菜单项仍保留已配置的提示
