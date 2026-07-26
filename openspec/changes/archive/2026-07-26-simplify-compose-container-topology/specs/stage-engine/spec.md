## MODIFIED Requirements

### Requirement: 场景索引与坐标空间

SceneIndex MUST 索引任意根与嵌套旋转 Frame，并提供最近 Frame、共同插入 Frame和按逆世界矩阵
命中的视觉最上层最深 Frame 查询。命中 MUST 排除不可见、锁定或被裁剪祖先遮挡的候选。

#### Scenario: 命中旋转嵌套 Frame

- **WHEN** Pointer 位于重叠且旋转的嵌套 Frame 附近
- **THEN** SceneIndex 使用局部矩形和反向 paint order 返回最深合法 Frame
- **AND** AABB 内但局部矩形外或被裁剪的候选不会命中

### Requirement: 统一外部拖入

controller MUST 允许 Frame/Component external descriptor 落到 Canvas 或最深合法 Frame，并在
键盘新增时从当前选择推导父级。Context 和 effect MUST 使用 nullable parentId，不得保存或发送
activeFrame 状态。

#### Scenario: 拖入根或嵌套 Frame

- **WHEN** Pointer 分别在 Frame 外和嵌套 Frame 内结束 external drag
- **THEN** drop effect 分别返回 null 和嵌套 Frame parentId
- **AND** Stage 创建节点时保持最终世界中心

#### Scenario: 键盘新增推导父级

- **WHEN** 选择 Frame、共享同一 Frame 的后代或没有共同 Frame
- **THEN** 新增目标分别为选中 Frame、共同最近 Frame 或 Canvas

## ADDED Requirements

### Requirement: 输出区域检查命中

controller MUST 接受独立的 output hit，并通过 output selection effect 请求宿主检查隐式 Canvas。
输出检查不得写入 selectedIds；节点、resize、rotate、guide 和平移命中 MUST 保持原优先级。

#### Scenario: 点击与框选输出区域

- **WHEN** 选择工具在输出区域空白处按下并松开
- **THEN** controller 清空节点选择并请求检查 output
- **AND** 从输出区域拖出有效框选后改为返回命中的节点选择

#### Scenario: 平移不切换检查目标

- **WHEN** pan 工具、Space 临时平移或中键从输出区域开始
- **THEN** controller 只更新 viewport
- **AND** 不发送 output selection effect

## MODIFIED Requirements

### Requirement: 世界几何保持的结构命令

stage-engine MUST 支持 nullable reparent，并使用 Frame 实现 group/ungroup。Frame resize MUST
只更新所选 Frame 自身 transform；移动或旋转 MUST 通过父矩阵影响后代。

#### Scenario: Resize Frame 不缩放孩子

- **WHEN** 用户 resize 根级或嵌套 Frame
- **THEN** Frame 的边界更新而全部后代局部 transform 保持不变
- **AND** pointerup 仍只派发一个 transform 事务
