## MODIFIED Requirements

### Requirement: 内建 Component 定义自带 Inspector

createComposeBuiltinComponentDefinitions MUST 为 Transform、Visibility、Lock、Appearance、
Hierarchy、TransformConstraints 与 `Frame` 提供符合 Registry Inspector 协议的编辑 UI；Lock Inspector
MUST 在 readOnly 上下文中仍可解除锁定；Clip 的开关由 Hierarchy Inspector 呈现。
`Frame` Inspector MUST 呈现常见尺寸预设与该 Frame 的辅助线，MUST NOT 重复呈现尺寸数值本身
（尺寸由几何分组的唯一尺寸字段编辑），也 MUST NOT 呈现背景（背景属于 Appearance 分组）。
`Frame` Inspector MUST 只依赖 core 的公共命令与读取函数，MUST NOT 依赖 Editor。

#### Scenario: Registry 协议驱动内建分组

- **WHEN** 宿主使用 createComposeBasicMaterials 构建 Registry
- **THEN** 编辑器无需硬编码即可按定义顺序渲染全部内建 Component 分组

#### Scenario: Frame 分组编辑预设与辅助线

- **WHEN** 用户选中一个拥有 `Frame` 的 Entity
- **THEN** Frame 分组显示常见尺寸预设与该 Frame 的辅助线列表
- **AND** 选择一个预设以一次可逆事务更新该 Frame 的尺寸

## ADDED Requirements

### Requirement: Frame 几何编辑约束

几何分组 MUST 是 Frame 尺寸的唯一入口。拥有 `Frame` 的 Entity MUST 满足两条约束：
尺寸模式 MUST 只提供固定值——`Frame` 禁止 Hug，在 UI 上暴露一个提交必然被文档校验拒绝的
选项没有意义；尺寸提交 MUST 改派 `entity.frame.size.set`，使 `Frame.size` 与布局回退在同一个
事务里保持一致，MUST NOT 只更新 `LayoutItem`——布局求解读的是 `Frame.size`，只写 `LayoutItem`
会让文档变了而画面不动。

#### Scenario: Frame 的尺寸只有一个入口

- **WHEN** 用户选中一个 Frame 并修改几何分组的尺寸
- **THEN** 系统派发 `entity.frame.size.set`，`Frame.size` 与布局回退同时更新
- **AND** 尺寸模式不提供 Hug 选项

#### Scenario: Auto Layout Frame 也不提供 Hug

- **WHEN** 用户为一个 Frame 启用 Auto Layout
- **THEN** 尺寸模式仍然只有固定值
