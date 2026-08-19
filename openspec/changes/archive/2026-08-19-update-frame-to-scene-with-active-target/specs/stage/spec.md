## ADDED Requirements

### Requirement: 场景标签的激活与预览入口

根 Frame 的标题标签 MUST 承载场景语义，且 MUST NOT 改变普通容器标签与锁定态标签的既有结构。
激活场景的标签 MUST 在名称**前**显示播放按钮，点击 MUST 请求宿主以该场景为目标打开预览；
每个场景标签 MUST 在名称**后**显示激活标记，激活态与未激活态 MUST 在形态上可区分而不只靠颜色，
点击未激活标记 MUST 请求宿主把该场景设为激活。两个新控件 MUST 各自具备本地化 accessible name。

播放按钮与激活标记 MUST 在 `pointerdown` 阶段阻止冒泡与默认动作，因此 MUST NOT 触发标签的
选中手势，也 MUST NOT 参与就地重命名的双击判定。名称按钮 MUST 保留既有 testid 与既有的
单击选中、双击重命名行为；新控件 MUST 使用各自独立的 testid，MUST NOT 复用容器标签的 testid 前缀。

标签容器 MUST 保持不吞掉画布指针事件：容器自身不接收指针事件，三个控件各自开启；名称仍 MUST
在超出可用宽度时省略号截断。标签层 MUST 保持在变换手柄层之下。

Stage MUST 在右键菜单中为根 Frame 提供「设为激活场景」，已是激活场景时 MUST 禁用。
Stage MUST 为激活场景的边界提供与选中态正交的视觉区分。

Stage MUST NOT 自行写入激活状态——它只发出请求，由宿主决定如何持久化。

#### Scenario: 激活场景标签显示播放与激活标记

- **WHEN** 页面有两个场景，其中第一个是激活场景
- **THEN** 第一个场景的标签在名称前显示播放按钮，名称后显示激活态标记
- **AND** 第二个场景的标签显示未激活态标记且没有播放按钮

#### Scenario: 点击标记请求切换激活

- **WHEN** 用户点击未激活场景标签上的标记
- **THEN** Stage 发出以该场景为目标的激活请求
- **AND** 该次点击不选中该场景，也不进入就地重命名

#### Scenario: 播放按钮请求预览

- **WHEN** 用户点击激活场景标签上的播放按钮
- **THEN** Stage 发出以该场景为目标的预览请求
- **AND** 该次点击不改变当前选择

#### Scenario: 名称按钮行为不变

- **WHEN** 用户单击场景标签的名称
- **THEN** 该场景被选中
- **WHEN** 用户在间隔内再次单击同一名称
- **THEN** 进入就地重命名输入态，且该输入态不显示播放按钮与激活标记

#### Scenario: 右键设为激活场景

- **WHEN** 用户右键一个非激活的根 Frame
- **THEN** 菜单出现「设为激活场景」
- **AND** 对已激活的场景该项被禁用

#### Scenario: 未提供回调时不出现控件

- **WHEN** 宿主没有提供激活或预览回调
- **THEN** 标签只渲染名称，不出现对应控件
- **AND** 既有容器标签行为完全不变

## MODIFIED Requirements

### Requirement: 多 Frame 与嵌套边界

Stage MUST 渲染 rootIds 中的每一个 Frame，并为每个 Frame 渲染可检查的边界。Frame 背景 MUST 使用
该 Frame 的 `Appearance.backgroundPaint`，默认透明并显示 1 屏幕像素非缩放边框；未选中边框 MUST
使用统一的主题中性色且不得复用 X/Y 轴颜色，选中 Frame 时四边 MUST 统一使用编辑器强调色；
激活场景的边界 MUST 具备与选中态正交的视觉区分，使「哪一块会被发布」在不选中时也看得见。
Stage MUST 在当前目标 Frame 的局部原点显示固定屏幕尺寸、Godot 风格的前景十字标记：MUST 精确
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

#### Scenario: 激活场景边界可辨认

- **WHEN** 页面有两个场景且都未被选中
- **THEN** 激活场景的边界与另一个场景在视觉上可区分
