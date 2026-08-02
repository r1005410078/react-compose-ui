## ADDED Requirements

### Requirement: Stage 右键操作菜单

Stage MUST 在节点和空白画布使用共享右键菜单呈现编辑、视图、工具和吸附操作。

#### Scenario: 右键未选节点
- **WHEN** 用户右键未选中的可见节点
- **THEN** Stage 先请求单选该节点并显示适用编辑操作

#### Scenario: 右键菜单显示当前 Stage 键位
- **WHEN** Stage 打开节点、视图、工具或吸附菜单
- **THEN** 每个实际配置的动作在菜单末尾显示当前 `shortcuts` 的全部键位
- **AND** 自定义配置立即生效，空数组隐藏提示，禁用菜单项仍保留已配置的提示
