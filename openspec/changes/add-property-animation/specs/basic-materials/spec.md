## ADDED Requirements

### Requirement: 内建动画能力与视觉安全通道

Materials MUST 默认注册 Animation Component Definition 与“动画”Capability，并组合 animation 包提供的
Inspector。能力 MUST 可附加到未锁定的 Renderer、Hierarchy、Group 与组件实例宿主，但命名后代槽位
MUST NOT 进入组件实例内部。Materials MUST 注册位置偏移、旋转、缩放、透明度和纯色背景通道，不得
把尺寸、Flow/Hug、padding、gap 或未知 Renderer Props 声明为 v1 可动画属性。

#### Scenario: 给 Rectangle 添加动画能力
- **WHEN** 用户从能力菜单给 Rectangle 添加“动画”
- **THEN** 一个事务附加空 Animation Component 并在 Inspector 显示资源、目标和播放参数
- **AND** Rectangle 既有 Appearance、Renderer 与 LayoutItem 保持不变

#### Scenario: 锁定节点不能编辑动画
- **WHEN** Entity 已锁定但保存了合法 Animation
- **THEN** Inspector 禁用资源、目标、参数和录制编辑
- **AND** Preview 仍可按保存配置播放动画

#### Scenario: 布局属性不进入自动记录
- **WHEN** Auto-keyframe 开启且用户修改 Flow/Hug、宽高、padding 或 gap
- **THEN** Materials 不把修改声明为动画通道
- **AND** 原有布局命令与 Yoga 求解语义保持不变

