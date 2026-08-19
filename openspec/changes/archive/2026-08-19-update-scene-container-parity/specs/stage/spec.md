## MODIFIED Requirements

### Requirement: 多 Frame 与嵌套边界

Stage MUST 渲染 rootIds 中的每一个 Frame，并为每个 Frame 渲染可检查的边界区域。Frame MUST 与
普通 Container 共用同一条呈现管线：背景、边框、圆角、透明度与阴影 MUST 全部来自该 Entity 自身
的 `Appearance`，Stage MUST NOT 为 Frame 额外绘制描边、选中轮廓或任何容器不会得到的装饰。
场景与容器在画布上的唯一视觉区别 MUST 是标题标签；「哪一块会被发布」MUST 由标签上的激活标记
承担，MUST NOT 依赖边界颜色差异。
Stage MUST 在当前目标 Frame 的局部原点显示固定屏幕尺寸、Godot 风格的前景十字标记：MUST 精确
使用 16×16 `EditorPosition` 双填充轮廓，外层为 `rgba(255,255,255,0.706)`，内层为 `#ff5f5f`；
不得以描边线条近似，也不得通过 halo 或轴线分段在原点周围制造缺口。X/Y 轴 MUST 分别使用
`rgba(245,51,82,0.75)` 与 `rgba(135,214,3,0.75)`。平移、缩放或 Frame 尺寸变化不得改变其锚点。
带 Hierarchy 的 Container Entity MUST 可以嵌套、旋转，并按 Clip 裁剪或显示溢出；嵌套 Frame MUST
建立独立局部原点；Frame 边界不得限制无限 Stage 中的编辑和滚动范围。

#### Scenario: 编辑输出边界外的根 Entity

- **WHEN** 某 Entity 被移动到其所属 Frame 的边界外
- **THEN** Stage 仍渲染、选择、移动和 resize 该 Entity
- **AND** Frame 区域只作为网格之上、Entity 之下的检查目标，不阻止边界外编辑

#### Scenario: 检查透明输出区域

- **WHEN** 用户点击某 Frame 中没有子级 Entity 覆盖的区域
- **THEN** Stage 选中该 Frame Entity 并在 Inspector 显示其属性
- **AND** 背景为 transparent 时网格透过 Frame 可见，且 Stage 不为该 Frame 补画任何边框
- **AND** 原点标记在连续 X/Y 轴之后按 Godot `EditorPosition` 的双填充路径和精确颜色绘制

#### Scenario: 渲染嵌套 Container 裁剪

- **WHEN** 嵌套 Container 切换 Clip.enabled，或场景中存在嵌套 Frame
- **THEN** Stage 对越界后代切换 hidden/visible overflow
- **AND** Container 与 Frame 的 Transform rotation 与后代世界几何保持一致

#### Scenario: 激活场景边界可辨认

- **WHEN** 页面有两个场景且都未被选中
- **THEN** 两块场景的边界本身没有任何视觉差异——场景与容器共用同一条呈现管线
- **AND** 激活场景由标题标签上的激活标记与播放按钮标出，因此不选中也看得见哪一块会被发布

## ADDED Requirements

### Requirement: 空白工作区的新建落点

在所有 Frame 之外新建 Entity 时，Stage MUST 按被创建 Entity 的类型分流，MUST NOT 回退到
`rootIds[0]`：

- 容器类 Entity（拥有 `Hierarchy` 且不是 Group）MUST 升格为一块新的根场景，几何取绘制或
  落点得到的世界坐标，外观与组件 MUST 原样保留。
- 其余 Entity MUST 落进**激活场景**，世界坐标 MUST 换算为该场景的局部坐标，并 MUST 钳制进
  该场景边界，使新建对象完整可见。

该规则 MUST 覆盖全部新建路径：绘制工具提交、物料面板拖放与点击添加、资源浏览器拖放。
无选中时的粘贴落点 MUST 同样解析为激活场景。

#### Scenario: 在场景外绘制容器得到新场景

- **WHEN** 用户用容器工具在所有场景之外拖出一个矩形区域
- **THEN** 文档 `rootIds` 增加一项，新场景位于绘制处并与既有场景并排
- **AND** 该操作是一次可撤销事务，且不改变页面的激活场景

#### Scenario: 在场景外绘制矩形落进激活场景

- **WHEN** 用户用矩形工具在所有场景之外拖出一个矩形
- **THEN** 该矩形成为激活场景的子级，其局部包围盒完整落在激活场景边界内

#### Scenario: 切换激活场景后落点跟随

- **WHEN** 页面有两块场景，用户把第二块设为激活场景后在空白处绘制矩形
- **THEN** 该矩形成为第二块场景的子级，而不是 `rootIds` 中第一块场景的子级
