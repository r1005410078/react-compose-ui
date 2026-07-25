## MODIFIED Requirements

### Requirement: 受控无限视口

Stage MUST 接收受控 viewport、tool、selectedIds 和 activeFrameId，并通过回调请求替换这些会话
状态。Viewport MUST 使用 screen surface 像素 x/y 与 0.1～8 范围 zoom；viewport、选择、工具和
动态滚动范围 MUST NOT 写入 ComposeDocument、History 或 Operation Log。网格设置与辅助线 MUST
只读取 ComposeDocument v2 canvas。

#### Scenario: 平移无限视口

- **WHEN** 用户使用 pan 工具、Space/中键拖动、滚轮或 scrollbar 平移
- **THEN** Stage 只请求更新 viewport x/y
- **AND** 文档、选择和事务历史保持不变

#### Scenario: 以游标为锚缩放

- **WHEN** 用户在 surface 内使用 Cmd/Ctrl 加滚轮缩放
- **THEN** zoom 被限制在 0.1～8
- **AND** 缩放前位于游标下方的世界坐标在缩放后仍位于同一 surface 位置

#### Scenario: 使用真实 surface 尺寸

- **WHEN** ruler、scrollbar 或宿主布局改变 Stage 可视区域
- **THEN** Stage 上报扣除固定 UI 后的真实 surface width/height
- **AND** Scene、Overlay、ruler、scrollbar 和 fit 计算使用同一尺寸

### Requirement: 直接移动缩放与旋转

Stage MUST 为可编辑选择提供移动、八向 resize 和 rotation handle。单选与多选 MUST 使用世界几何
计算结果，再转换为各自父节点局部 transform；move 与 resize MUST 使用统一吸附引擎，一次完成
的手势 MUST 只派发一个 transform 命令或 batch。

#### Scenario: 移动单选或多选

- **WHEN** 用户拖动一个未锁定选择或共同包围框
- **THEN** 所有目标在 Pointer 预览中保持相对位置并应用启用的吸附
- **AND** pointerup 只提交一次包含最终局部 transform 的事务

#### Scenario: 八向缩放并吸附活动边

- **WHEN** 用户拖动任一 resize handle
- **THEN** 活动边或角参与智能和网格吸附，且尺寸不会跨过最小正尺寸
- **AND** Shift 保持初始宽高比，Alt 从中心对称缩放

#### Scenario: 旋转选择

- **WHEN** 用户拖动 rotation handle
- **THEN** 选择围绕共同中心旋转
- **AND** Shift 把角度量化到 15°，pointerup 提交一次最终事务

### Requirement: 屏幕距离吸附

move 与 resize MUST 支持网格、可见未选中节点和全局辅助线吸附。节点与辅助线
阈值 MUST 固定为 6 屏幕像素；智能候选 MUST 优先于网格，距离相同时辅助线优先。Cmd/Ctrl MUST
临时关闭全部吸附，节点/辅助线命中时 MUST 显示瞬时参考线。

#### Scenario: 智能吸附优先

- **WHEN** 同一轴在 6 屏幕像素内同时存在辅助线或节点候选且网格吸附已开启
- **THEN** Stage 选择最小智能修正，距离相同时选择辅助线
- **AND** 只在没有智能候选时把 move 左上角或 resize 活动边量化到 grid

#### Scenario: 不同 zoom 下保持吸附手感

- **WHEN** 用户在不同 zoom 下把选择拖到智能候选 6 屏幕像素范围内
- **THEN** Stage 使用换算后的世界距离得到相同屏幕阈值
- **AND** 参考线与最终吸附位置在屏幕上对齐

#### Scenario: 临时关闭全部吸附

- **WHEN** 用户在变换或辅助线拖动期间按住 Cmd/Ctrl
- **THEN** 几何跟随原始指针且不量化到 grid、不显示 snap guide
- **AND** 松开修饰键后吸附可以继续参与当前预览

## ADDED Requirements

### Requirement: 自适应网格标尺与世界原点

Stage MUST 在 24px 顶部和左侧 ruler 内显示随 viewport 与 canvas grid 更新的正负世界坐标，
并在 surface 显示细网格、主网格、红色 X 轴与绿色 Y 轴。视觉抽稀 MUST NOT 改变实际 snap step。

#### Scenario: 平移缩放标尺网格

- **WHEN** viewport 平移、缩放或 grid step/offset/primaryLineEvery 改变
- **THEN** ruler label、tick、细线与主线在相同世界位置对齐
- **AND** 过密线按 zoom 抽稀但节点仍吸附到原始配置刻度

#### Scenario: 显示世界原点交叉

- **WHEN** 世界 `(0,0)` 位于或移入可视 surface
- **THEN** 红色水平 X 轴与绿色垂直 Y 轴在该点交叉
- **AND** 轴线随 viewport 变换且位于节点内容下方

#### Scenario: 标记选择尺寸

- **WHEN** 存在单选或多选并进行 move、resize 或 rotate 预览
- **THEN** 顶部和左侧 ruler 实时标记世界 AABB 起止位置
- **AND** 分别显示最多两位小数的宽度与高度

### Requirement: 可拖拽全局辅助线

Stage MUST 允许从 ruler 创建、移动和删除全局世界辅助线。Pointermove MUST 只更新预览；
pointerup MUST 最多派发一个 canvas 命令或 batch，取消 MUST 不修改文档。

#### Scenario: 从标尺创建辅助线

- **WHEN** 用户从顶部或左侧 ruler 拖入 surface
- **THEN** Stage 预览垂直或水平 guide，并在 pointerup 创建一个文档 guide
- **AND** grid snap 开启时 guide position 量化到对应刻度

#### Scenario: 从交叉角创建双轴辅助线

- **WHEN** 用户从两个 ruler 的交叉角拖入 surface
- **THEN** 同时预览水平和垂直 guide
- **AND** pointerup 通过一个 batch 创建两条可共同撤销的 guide

#### Scenario: 移动删除或取消辅助线

- **WHEN** 用户移动已有 guide、拖回对应 ruler，或取消手势
- **THEN** pointerup 分别提交 move、delete，取消则恢复原位置且不创建事务
- **AND** guide 创建、移动和删除进入 History 与 Operation Log

### Requirement: 无限画布滚动条

Stage MUST 在 surface 右侧和底部提供 10px 自定义 scrollbar。虚拟范围 MUST 包含可见节点、世界
原点、当前可视 world rect 及每边至少一屏 padding，并在当前挂载会话内只扩不缩。Scrollbar
MUST 只修改 viewport。

#### Scenario: 拖动滚动条平移

- **WHEN** 用户拖动水平或垂直 thumb
- **THEN** viewport 按虚拟 world range 平移且 Scene、grid、ruler、guide 同步更新
- **AND** ComposeDocument、History 与 Operation Log 保持不变

#### Scenario: 动态扩展无限范围

- **WHEN** 内容、平移或 thumb 到达现有虚拟范围边缘
- **THEN** 对应方向至少扩展一个可视 world span
- **AND** 已建立范围不因节点删除或缩小而跳回

#### Scenario: 键盘操作可访问滚动条

- **WHEN** 聚焦 scrollbar 后使用 Arrow、Page、Home 或 End
- **THEN** viewport 按小步、翻页或边界规则移动
- **AND** scrollbar 暴露 orientation、controls、valuemin、valuemax 与 valuenow
