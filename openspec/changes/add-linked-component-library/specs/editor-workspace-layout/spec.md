## ADDED Requirements

### Requirement: 保存和编辑项目组件
Editor MUST 允许从单个选中 Entity 子树创建项目组件，并在独立文档标签中编辑、暴露属性和保存源文件。

#### Scenario: 保存选中子树
- **WHEN** 用户从 Stage 或 Scene Tree 右键选择“保存为项目组件”并确认名称与目录
- **THEN** Editor 创建根坐标归零、输出尺寸匹配解析尺寸的单根组件文件

#### Scenario: 独立编辑主组件
- **WHEN** 用户双击组件面板或资源面板中的组件文件
- **THEN** Editor 在独立 Runtime 标签中打开并提供 dirty、保存、关闭确认和 revision 冲突处理

#### Scenario: 暴露属性
- **WHEN** 用户在主组件文档中把支持的属性行暴露并命名
- **THEN** 文件保存稳定 property ID，实例 Inspector 显示对应编辑器

### Requirement: 提示后更新关联实例
Editor MUST 检测源 revision 变化但不得自动改写文档；用户确认后 MUST 以一次可撤销事务更新实例快照、兼容 overrides 和宽高。

#### Scenario: 保留兼容覆盖
- **WHEN** 新 revision 保留相同 ID 和兼容类型的显式属性
- **THEN** 更新重放 override、同步主组件尺寸并保留实例位置和旋转

#### Scenario: 不兼容覆盖需要确认
- **WHEN** 新 revision 删除或改变了已有 override 的属性
- **THEN** Editor 列出冲突并在用户明确同意丢弃前保持旧实例不变
