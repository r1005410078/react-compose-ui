## MODIFIED Requirements

### Requirement: 多 Frame 与嵌套边界

Stage MUST 渲染 rootIds 中的每一个 Frame，并为每个 Frame 渲染可检查的边界区域。Frame MUST 与
普通 Container 共用同一条**内容**呈现管线：背景、圆角、透明度与阴影 MUST 全部来自该 Entity
自身的 `Appearance`，Stage MUST NOT 为 Frame 额外绘制选中轮廓或任何容器不会得到的内容装饰。

Stage MUST 为每块场景绘制一条编辑器边界描边。它是 chrome 而不是内容：MUST 使用恒定屏幕宽度
（不随视口缩放变粗）、MUST 画在 Scene 之下的世界底图层、MUST NOT 接收指针事件、MUST NOT 写入
文档、MUST NOT 出现在预览与导出中，也 MUST NOT 参与布局求解的内容盒——场景是绝对坐标的原点，
把它计入内容盒会让每个直接子级整体推离网格。该描边 MUST 与 Entity 自身 `Appearance.borderWidth`
画出的边框并存而不互相取代。

场景默认背景是透明的，边界因此只能由这条描边承担；用户把场景背景改成与工作区相同的颜色时，
边界同样只由它承担。场景与容器在画布上的区别 MUST 是标题标签与这条边界描边；「哪一块会被
发布」MUST 由标签上的激活标记承担，MUST NOT 依赖边界颜色差异——所有场景的边界描边一视同仁。

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
- **THEN** Stage 不选中该 Frame Entity，按顶层容器体的命中收敛起框
- **AND** 背景为 transparent 时网格透过 Frame 可见，且该 Frame 的边界仍由编辑器边界描边标出
- **AND** 原点标记在连续 X/Y 轴之后按 Godot `EditorPosition` 的双填充路径和精确颜色绘制

#### Scenario: 场景边界描边不随缩放变粗

- **WHEN** 用户把视口从 100% 缩放到 25% 再放大到 400%
- **THEN** 每块场景的边界描边在屏幕上始终是同一个宽度
- **AND** 描边不接收指针事件，在场景边缘按下仍按边缘之下的内容判定

#### Scenario: 边界描边不进入内容盒

- **WHEN** 用户把一个子级按网格吸附拖到默认场景中
- **THEN** 属性面板里的位置坐标落在网格倍数上，不被边界描边推离

#### Scenario: 渲染嵌套 Container 裁剪

- **WHEN** 嵌套 Container 切换 Clip.enabled，或场景中存在嵌套 Frame
- **THEN** Stage 对越界后代切换 hidden/visible overflow
- **AND** Container 与 Frame 的 Transform rotation 与后代世界几何保持一致

#### Scenario: 激活场景边界可辨认

- **WHEN** 页面有两个场景且都未被选中
- **THEN** 两块场景的边界描边没有任何视觉差异
- **AND** 激活场景由标题标签上的激活标记与播放按钮标出，因此不选中也看得见哪一块会被发布

### Requirement: Stage Frame 背景 Paint

ComposeStage MUST 在每个 Frame 的边界内渲染其 `Appearance.backgroundPaint` 的共享 Paint 描述。
Frame 背景 MUST 参与 Frame Entity 自身的 Paint edit/sample session，MUST NOT 被其后代
Entity 的命中测试吞掉。Frame 背景 MUST NOT 因此成为 Frame Entity 的选中入口——选中走标题
标签、`command` 点体或场景树。

#### Scenario: 编辑渐变输出背景

- **WHEN** Frame Inspector 提交合法的 Gradient Paint
- **THEN** Stage 在下一文档快照显示对应 Frame 渐变
- **AND** 现有 Entity 选择、移动、命中测试和渐变控制柄目标保持不变

#### Scenario: Paint 采样仍可作用于场景背景

- **WHEN** Paint sample session 进行中，用户在场景背景上按下
- **THEN** 采样命中该场景的背景 Paint，不被命中收敛改写为框选
