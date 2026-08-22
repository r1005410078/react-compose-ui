## ADDED Requirements

### Requirement: 编辑器提供绘图模式

编辑器的模式切换器 MUST 提供设计、绘图、动画三段，切换到绘图 MUST 把 Stage 切进绘图模式并
把画布工具栏换成绘图工具。

切换器 MUST 保持 radiogroup 语义：方向键在各段之间移动并立即生效，且 MUST NOT 假设只有两个
选项——按索引循环而不是「另一个就是对面那个」。

绘图模式 MUST NOT 隐藏或改造场景树、属性面板与 Palette：对象世界归页面，绘图模式只换输入
方式。

#### Scenario: 三段切换

- **WHEN** 用户在切换器上选择绘图
- **THEN** Stage 进入绘图模式，工具栏显示绘图工具

#### Scenario: 方向键循环

- **WHEN** 焦点在切换器上并连续按方向键
- **THEN** 依次经过三段并立即生效

#### Scenario: 面板不受模式影响

- **WHEN** 进入绘图模式
- **THEN** 场景树与属性面板仍然可见且可用
