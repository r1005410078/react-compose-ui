## ADDED Requirements

### Requirement: 布局属性不进入动画录制

Materials MUST NOT 把尺寸、Flow/Hug、padding、gap 或未知 Renderer Props 声明为可动画属性。
Auto-keyframe 开启时，这些属性的修改 MUST 保持原有布局命令与 Yoga 求解语义。

#### Scenario: 布局属性不进入自动记录

- **WHEN** Auto-keyframe 开启且用户修改 Flow/Hug、宽高、padding 或 gap
- **THEN** Materials 不把修改声明为动画通道，修改照常提交文档事务
- **AND** 原有布局命令与 Yoga 求解语义保持不变

#### Scenario: 视觉属性正常参与录制

- **WHEN** Auto-keyframe 开启且用户修改 Absolute 子节点位置、旋转、透明度或纯色背景
- **THEN** Materials 声明的可动画通道允许 recording adapter 转换为动画草稿操作
- **AND** 对应 authored 字段保持不变
