## MODIFIED Requirements

### Requirement: 内置文档命令

core MUST 提供 Frame、Group、Component 创建、删除、复制、重命名、重排、移动、显隐、锁定、
属性路径更新/重置、transform 更新、group/ungroup、canvas configure、guide create/move/delete
与 batch 命令。命令 MUST 复用同一文档校验与事务边界；无效目标或配置 MUST 返回 noop 或带稳定
原因的 rejection。

#### Scenario: 原子创建和删除节点

- **WHEN** 宿主创建合法 Frame 或在 Frame/Group 中创建 Component，再删除任意合法子树
- **THEN** 节点表、rootIds/childIds 与事务 inverse 保持一致

#### Scenario: 修改属性和变换

- **WHEN** 宿主更新 Component JSON 属性路径或未锁定节点 transform
- **THEN** 只修改指定目标并生成可逆 Patch
- **AND** 非法 JSON、尺寸或锁定目标不会修改文档

#### Scenario: 配置画布并撤销

- **WHEN** 宿主派发合法 canvas.configure 后执行 undo/redo
- **THEN** grid 与 smartSnap 先精确恢复旧值再恢复新值
- **AND** 每次成功配置只形成一个可审计事务

#### Scenario: 创建移动和删除辅助线

- **WHEN** 宿主依次创建、移动、删除一个合法 guide
- **THEN** 每个命令生成精确 forward/inverse Patch
- **AND** 缺失、重复或非法 guide 请求被稳定拒绝且文档不变

#### Scenario: 批处理命令

- **WHEN** batch 中的全部子命令有效
- **THEN** 它们作为一个可撤销事务提交
- **WHEN** 任一子命令失败
- **THEN** 整个 batch 被拒绝且文档不变
