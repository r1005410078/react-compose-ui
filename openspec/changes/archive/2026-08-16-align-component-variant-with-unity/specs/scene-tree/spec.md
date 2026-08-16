## ADDED Requirements

### Requirement: 场景树区分组件实例与普通节点

场景树 MUST 为 component-instance 使用组件符号图标（空心，表示引用），MUST NOT 使用与主组件库
实心图标相同的填充样式冒充库本体。普通物料节点 MUST 继续使用其物料图标。节点 accessible name
或可见标签 MUST 不暗示页面行为「创建变体」。

#### Scenario: 实例行使用组件符号

- **WHEN** 场景树包含 component-instance 与 Rectangle 子节点
- **THEN** 实例行显示空心组件符号，Rectangle 显示矩形类图标

#### Scenario: 复制不改变树语义为变体资源

- **WHEN** 用户通过场景树复制组件实例节点
- **THEN** 树中出现第二个实例节点
- **AND** 不出现新的库资源创建成功作为该操作的必然结果
