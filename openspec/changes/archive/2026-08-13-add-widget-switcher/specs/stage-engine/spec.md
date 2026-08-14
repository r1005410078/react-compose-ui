## MODIFIED Requirements

### Requirement: ECS SceneIndex

Stage Engine MUST 从 ComposeDocument v6 与 ready ComposeLayoutSnapshot 建立 parent、世界矩阵、
可见性、锁定、容器、裁剪与 GeometryConstraints 索引。全部世界几何 MUST 使用 Snapshot box 加
Transform rotation，缓存 MUST 同时区分 document 与 snapshot revision。

SceneIndex MUST 接受一个可选的隐藏 Entity ID 集合，并把集合内 Entity 及其全部后代计为不可见。
集合由宿主传入——它同时包含 WidgetSwitcher 的非活动子项与编辑期预览覆盖的结果，因此 Stage Engine
MUST NOT 自行读取选择状态，保持与 React 与编辑器状态无关。

#### Scenario: Snapshot 改变使空间索引失效
- **WHEN** 文档引用不变但 Layout Snapshot revision 与子项 box 改变
- **THEN** SceneIndex 返回新的世界矩阵、bounds、命中与裁剪结果
- **AND** 不读取旧 Transform position/size

#### Scenario: 隐藏集合不可命中

- **WHEN** 以含某个 Entity 的隐藏集合建立 SceneIndex 并在该 Entity 上做命中测试
- **THEN** 命中结果不返回该 Entity，也不返回它的任何后代
- **AND** 隐藏集合为空时行为与此前一致
