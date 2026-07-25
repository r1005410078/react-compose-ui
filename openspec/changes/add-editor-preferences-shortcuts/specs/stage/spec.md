## ADDED Requirements

### Requirement: 可配置 Stage 快捷键

Stage MUST 接受可选 locale 与快捷键配置，并在未提供时保持 zh-CN 和现有默认键位。默认动作
MUST 包括临时平移、select/pan 工具、适配选择/Frame、100%/放大/缩小、grid/smart snap、
duplicate、group/ungroup 和 delete；动作只通过现有会话回调或 dispatch 边界生效。

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

### Requirement: 临时平移生命周期

Stage MUST 在统一 pointer capture 决策边界识别临时平移，使拖动可以从空白、Frame 或节点开始。
临时平移期间 MUST 只请求 viewport 更新，并在 keyup、window blur、pointercancel 或
lostpointercapture 时清理按键与手势状态。

#### Scenario: 从任意命中区域临时平移

- **WHEN** 用户按住临时平移键并从 Stage 空白、Frame 或节点开始拖动
- **THEN** viewport 按指针位移更新
- **AND** selection、document、History 与 Operation Log 保持不变

#### Scenario: 清理中断的临时平移

- **WHEN** 临时平移期间发生按键释放、窗口失焦、pointer cancel 或失去 capture
- **THEN** Stage 结束手势并清理临时按键状态
- **AND** 后续普通点击或拖动不会继续平移

### Requirement: Stage 内建本地化

Stage 的默认 toolbar、ruler/scrollbar ARIA、空状态、错误占位与手势反馈 MUST 支持 zh-CN 和
en-US；宿主 renderer 和 registry label MUST 保持原文。

#### Scenario: 使用英文 Stage chrome

- **WHEN** 宿主以 en-US 挂载 Stage
- **THEN** Stage 内建可见文案和可访问名称显示英文
- **AND** Frame 名称、registry label 与组件业务内容不被翻译
