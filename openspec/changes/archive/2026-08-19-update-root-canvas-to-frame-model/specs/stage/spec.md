## MODIFIED Requirements

### Requirement: 多 Frame 与嵌套边界

Stage MUST 渲染 rootIds 中的每一个 Frame，并为每个 Frame 渲染可检查的边界。Frame 背景 MUST 使用
该 Frame 的 `Appearance.backgroundPaint`，默认透明并显示 1 屏幕像素非缩放边框；未选中边框 MUST
使用统一的主题中性色且不得复用 X/Y 轴颜色，选中 Frame 时四边 MUST 统一使用编辑器强调色。
Stage MUST 在当前活动 Frame 的局部原点显示固定屏幕尺寸、Godot 风格的前景十字标记：MUST 精确
使用 16×16 `EditorPosition` 双填充轮廓，外层为 `rgba(255,255,255,0.706)`，内层为 `#ff5f5f`；
不得以描边线条近似，也不得通过 halo 或轴线分段在原点周围制造缺口。X/Y 轴 MUST 分别使用
`rgba(245,51,82,0.75)` 与 `rgba(135,214,3,0.75)`。平移、缩放或 Frame 尺寸变化不得改变其锚点。
带 Hierarchy 的 Container Entity MUST 可以嵌套、旋转，并按 Clip 裁剪或显示溢出；嵌套 Frame MUST
按自身边界裁剪并建立独立局部原点；Frame 边界不得限制无限 Stage 中的编辑和滚动范围。

#### Scenario: 编辑输出边界外的根 Entity

- **WHEN** 某 Entity 被移动到其所属 Frame 的边界外
- **THEN** Stage 仍渲染、选择、移动和 resize 该 Entity
- **AND** Frame 区域只作为网格之上、Entity 之下的检查目标，不阻止边界外编辑

#### Scenario: 检查透明输出区域

- **WHEN** 用户点击某 Frame 中没有子级 Entity 覆盖的区域
- **THEN** Stage 选中该 Frame Entity 并在 Inspector 显示其属性
- **AND** 网格透过 transparent 背景可见，边框在任意 zoom 下保持 1 屏幕像素
- **AND** 未选中时四边使用同一主题中性色且不与 X/Y 轴混淆，选中时四边统一使用强调色
- **AND** 原点标记在连续 X/Y 轴之后按 Godot `EditorPosition` 的双填充路径和精确颜色绘制

#### Scenario: 渲染嵌套 Container 裁剪

- **WHEN** 嵌套 Container 切换 Clip.enabled，或场景中存在嵌套 Frame
- **THEN** Stage 对越界后代切换 hidden/visible overflow，嵌套 Frame 始终按自身边界裁剪
- **AND** Container 与 Frame 的 Transform rotation 与后代世界几何保持一致

### Requirement: Stage Frame 背景 Paint

ComposeStage MUST 在每个 Frame 的边界内渲染其 `Appearance.backgroundPaint` 的共享 Paint 描述。
Frame 背景 MUST 参与 Frame Entity 自身的选中与 Paint edit/sample session，MUST NOT 被其后代
Entity 的命中测试吞掉。

#### Scenario: 编辑渐变输出背景

- **WHEN** Frame Inspector 提交合法的 Gradient Paint
- **THEN** Stage 在下一文档快照显示对应 Frame 渐变
- **AND** 现有 Entity 选择、移动、命中测试和渐变控制柄目标保持不变

### Requirement: 可拖拽 Frame 局部辅助线

Stage MUST 允许从 ruler 创建、移动和删除辅助线，辅助线归属当前活动 Frame 并使用该 Frame 的局部
坐标。Pointermove MUST 只更新预览；pointerup MUST 最多派发一个命令或 batch，取消 MUST 不修改文档。

顶部（水平）ruler MUST 拖出水平 guide，左侧（垂直）ruler MUST 拖出垂直 guide；ruler 自身的
轴与 guide 的轴互为反向。手势停留在该 guide 所属 ruler 内时，Stage MUST 给出可识别的删除
光标提示，并在 pointerup 删除该 guide。活动 Frame 切换时 Stage MUST 只显示该 Frame 的辅助线。

#### Scenario: 从标尺创建辅助线

- **WHEN** 用户从顶部 ruler 拖入 surface
- **THEN** Stage 预览并创建一条由活动 Frame 局部 Y 定位的水平 guide
- **WHEN** 用户从左侧 ruler 拖入 surface
- **THEN** Stage 预览并创建一条由活动 Frame 局部 X 定位的垂直 guide
- **AND** grid snap 开启时 guide position 量化到对应刻度

#### Scenario: 从交叉角创建双轴辅助线

- **WHEN** 用户从两个 ruler 的交叉角拖入 surface
- **THEN** 同时预览水平和垂直 guide
- **AND** pointerup 通过一个 batch 创建两条可共同撤销的 guide

#### Scenario: 移动删除或取消辅助线

- **WHEN** 用户移动已有 guide、拖回对应 ruler，或取消手势
- **THEN** pointerup 分别提交 move、delete，取消则恢复原位置且不创建事务
- **AND** guide 创建、移动和删除进入 History 与 Operation Log

#### Scenario: 拖回标尺时提示删除

- **WHEN** 辅助线手势的指针停留在该 guide 所属的 ruler 内
- **THEN** Stage 发出 `guide-delete` 语义光标，UI 显示带删除标记的指针
- **AND** 指针离开该 ruler 后光标恢复为手势的常规光标

#### Scenario: 切换活动 Frame

- **WHEN** 用户在多画板文档中把活动 Frame 从 A 切换到 B
- **THEN** Stage 只显示 B 的辅助线，A 的辅助线保持不变且不被删除

## RENAMED Requirements

- FROM: `### Requirement: 多 Container 与输出边界`
- TO: `### Requirement: 多 Frame 与嵌套边界`
- FROM: `### Requirement: Stage 输出背景 Paint`
- TO: `### Requirement: Stage Frame 背景 Paint`
- FROM: `### Requirement: 可拖拽全局辅助线`
- TO: `### Requirement: 可拖拽 Frame 局部辅助线`

## ADDED Requirements

### Requirement: 跨 Frame 拖拽与重设父级

Stage MUST 允许把 Entity 从一个 Frame 拖入另一个 Frame，并 MUST 在落点提交时把其
`LayoutItem.offset` 从源 Frame 局部坐标转换为目标 Frame 局部坐标，使屏幕位置保持不变。
若被拖动的 Entity 或其后代携带属于源 Frame 的动画轨道，Stage MUST 在同一个事务中调用动画包的
轨道重定位命令，把这些轨道及其所属动画搬迁到目标 Frame，MUST NOT 静默丢弃关键帧。搬迁产生的
动画清单变化 MUST 与结构变化在同一次撤销中一起回滚。

#### Scenario: 无动画 Entity 跨 Frame 拖入

- **WHEN** 用户把一个没有动画轨道的矩形从 Frame A 拖入 Frame B
- **THEN** 该 Entity 成为 B 的子级，屏幕位置在提交前后保持不变
- **AND** 操作作为一个可撤销事务进入 History 与 Operation Log

#### Scenario: 携带轨道的 Entity 跨 Frame 拖入

- **WHEN** 用户把一个携带动画轨道的 Entity 从 Frame A 拖入 Frame B
- **THEN** 该 Entity 成为 B 的子级，其轨道按重定位规则出现在 B 的动画清单下且关键帧值不变
- **AND** 结构变化与轨道搬迁在同一个事务中，一次撤销即完整还原 A 的清单与该 Entity 的归属

#### Scenario: 提示不可自动合并的搬迁

- **WHEN** 轨道重定位因目标 Frame 已存在同名冲突动画而无法自动合并
- **THEN** Stage 在提交前呈现选择目标动画或新建动画的提示
- **AND** 用户取消时文档与撤销历史不发生变化
