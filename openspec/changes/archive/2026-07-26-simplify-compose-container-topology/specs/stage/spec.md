## MODIFIED Requirements

### Requirement: 多 Frame 与输出边界

Stage MUST 渲染位于世界 `(0,0)` 的可检查文档输出边界，并渲染 rootIds 中任意 Frame 或
Component。输出背景 MUST 使用 document.output，默认透明并显示 1 屏幕像素非缩放边框；
水平边使用 X 轴颜色，垂直边使用 Y 轴颜色。Stage MUST 在世界 `(0,0)` 显示固定屏幕尺寸、
Godot 风格的前景十字标记：MUST 精确使用 16×16 `EditorPosition` 双填充轮廓，外层为
`rgba(255,255,255,0.706)`，内层为 `#ff5f5f`；不得以描边线条近似，也不得通过 halo 或轴线
分段在原点周围制造缺口。X/Y 轴和对应 output 边 MUST 分别使用
`rgba(245,51,82,0.75)` 与 `rgba(135,214,3,0.75)`。平移、缩放或 output 尺寸变化不得改变其
世界锚点。
激活输出检查时不得显示节点变换手柄。Frame MUST 可以嵌套、旋转，并按 clipContent 裁剪或
显示溢出；输出边界不得限制无限 Stage 中的编辑和滚动范围。

#### Scenario: 编辑输出边界外的根组件

- **WHEN** 根 Component 位于文档输出边界外
- **THEN** Stage 仍渲染、选择、移动和 resize 该组件
- **AND** 输出区域只作为网格之上、节点之下的检查目标，不阻止边界外编辑

#### Scenario: 检查透明输出区域

- **WHEN** 用户点击没有节点覆盖的输出区域
- **THEN** Stage 发送 output inspection 回调并清空节点选择
- **AND** 网格透过 transparent 背景可见，边框在任意 zoom 下保持 1 屏幕像素
- **AND** 底边匹配 X 轴颜色，右边匹配 Y 轴颜色
- **AND** 原点标记在连续 X/Y 轴之后按 Godot `EditorPosition` 的双填充路径和精确颜色绘制

#### Scenario: 渲染嵌套 Frame 裁剪

- **WHEN** 嵌套 Frame 切换 clipContent
- **THEN** Stage 对越界后代切换 hidden/visible overflow
- **AND** Frame rotation 与后代世界几何保持一致

### Requirement: 分组与重设父节点

Stage MUST 允许根或 Frame 内的同父级混合选择通过 group 创建 Frame，并允许 ungroup 任意含孩子
Frame。SceneTree 与 Stage MUST 使用同一 nullable reparent 规划器保持世界几何。

#### Scenario: 根级分组和取消分组

- **WHEN** 用户组合根级 Frame/Component 并随后取消组合
- **THEN** 选择先变为新 Frame，再变为提升后的孩子
- **AND** 每个动作最多提交一个事务

### Requirement: ComponentPalette 拖入

ComponentPalette MUST 允许 Component 和 Frame descriptor 落到最深合法 Frame或 Canvas；Pointer
和键盘路径 MUST 使用同一 selection/hit 父级规则且不依赖 activeFrameId。

#### Scenario: 拖到空白 Canvas

- **WHEN** 用户把 Component 或 Frame 拖到没有 Frame 命中的世界点
- **THEN** 节点作为 rootIds 末尾的根节点创建并选中

#### Scenario: 拖到嵌套 Frame

- **WHEN** 用户把 Component 或 Frame 拖到可见未锁定的嵌套 Frame
- **THEN** 新节点成为该 Frame 的最后一个孩子
- **AND** 提交后的世界中心匹配 drop 点
