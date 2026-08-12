## MODIFIED Requirements

### Requirement: ECS 结构命令

Reparent 与 Duplicate MUST 接受开始 Layout Snapshot，并按目标 parent Layout 决定 positioning、offset
与 Fill 转换；Group/Ungroup MUST 为 Flow 目标返回稳定不可用原因。Group MUST 只接受同一直接父级、
顶层、Absolute、未锁定选择，并通过 Core Group seed 创建 `Composition.presetId: "group"` 的无外观
结构 Entity，保持世界几何、sibling 顺序和 Undo/Redo。Ungroup MUST 拒绝普通 Container，但允许
first-class Group 与精确匹配旧 Group seed 的 `presetId: null` 兼容结构。

#### Scenario: Scene Tree 跨布局移动

- **WHEN** 节点从 free parent 移入 Layout、在 Layout 间移动或移出到 free parent
- **THEN** 分别得到 Flow、保持 Flow、或烘焙 Absolute 的确定 LayoutItem
- **AND** 一个 Undo 恢复 parent、index 与全部原 authoring 值

#### Scenario: 成组生成 first-class Group

- **WHEN** 用户对同一 free parent 下的两个或更多顶层 Absolute 节点执行 Group
- **THEN** planner 生成无 Renderer/Appearance/Clip/Layout 的 `presetId: "group"` Entity
- **AND** 子项世界几何、相对顺序和一次 Undo/Redo 保持确定

#### Scenario: 限定解除分组

- **WHEN** 用户对普通 Container、first-class Group 或历史 Group 兼容结构请求 Ungroup
- **THEN** 普通 Container 返回稳定不可用原因
- **AND** 两类 Group 提升子项并保持世界几何

## ADDED Requirements

### Requirement: Group 动态编辑范围

Stage Engine MUST 使用 Group 的可见后代世界 bounds 并集作为命中、吸附和选择反馈范围，不得因后代
移动而改写 Group 持久化 LayoutItem；没有可见后代时 MUST 回退到持久化 frame。

#### Scenario: 后代移出初始范围

- **WHEN** Group 子项移动到初始持久化 frame 之外
- **THEN** Group 编辑范围扩展到新的可见后代并集
- **AND** Group 的 LayoutItem 与文档 revision 不因此改变
