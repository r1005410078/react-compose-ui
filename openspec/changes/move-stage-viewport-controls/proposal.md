# 变更：重整 Stage 工具栏与画布工具

## 原因

默认 Stage 工具栏混合了选择、容器适配、吸附、设置与缩放操作，工具语义与画布反馈没有一一对应；缩放又
占据工具栏空间。实施工程师难以一眼判断当前是选择、精确移动、缩放、旋转还是绘制状态，也无法从工具栏
直接画出常用基础图形。

## 变更内容

- 采用 Godot 风格的平铺式默认工具栏：常态图标没有逐个 Card 或整组胶囊背景，仅当前工具或 hover 使用
  低调状态底色，并按操作类别使用细分割线。
- 将默认工具扩展为：选择/变换、精确移动、缩放、旋转、移动画布、吸附开关、网格可见性与网格大小菜单、
  容器绘制、形状绘制菜单（矩形、线、箭头、圆）和文字绘制。
- 选择/变换维持普通箭头图标，并支持选择、框选、拖动移动和四角缩放；只显示四个小方块，边缘 hover
  通过对应方向的 resize cursor 提示可缩放。精确移动工具被单独激活时才显示 Godot 风格的红 X、绿 Y
  轴 gizmo，轴向拖动锁定对应坐标轴。
- 容器、矩形和文本基于现有或新增的第一方 Preset 进行拖拽绘制；线、箭头和圆由新的第一方矢量形状
  material 提供，不把临时 SVG 字符串塞入 editor 或 Stage engine。
- 默认快捷键包括 `V` 选择、`M` 精确移动、`S` 缩放、`R` 旋转、`H` 移动画布、`C` 容器、`R` 矩形、
  `L` 线、`Shift+L` 箭头、`O` 圆、`T` 文字；由于 `R` 同时被旋转和矩形请求，实施前需以快捷键冲突检查
  结果为准确定最终绑定（见设计中的待确认项）。
- 将居中、缩小、缩放百分比与放大从顶部工具栏移到画布 surface 左上；它们保持 Godot 风格的无外框行内
  控件，居中视图回到世界原点居中与 100%。
- Line 与 Arrow 补充常用 SVG 线条属性：描边颜色与粗细、端点形状、实线/虚线/点线、起点/终点箭头；单选
  两点 Shape 时使用蓝色线段、首尾两个控制点和长度浮标，不再以矩形选区误导用户。

## 影响

- 受影响规范：`editor-workspace-layout`、`stage`、`stage-engine`、`basic-materials`、
  `editor-preferences`
- 受影响代码：`packages/stage-engine` 的工具/绘制 state machine，`packages/stage` 的受控工具协议、
  overlay 和快捷键，`packages/editor` 的 toolbar、viewport controls、i18n 和 preferences，
  `packages/materials` 的 Shape renderer 与 Presets
- 公共 API：`ComposeStageTool`、Stage shortcut actions 和 editor preference actions 会增加工具与绘制
  动作；原有 `select | pan` 使用保持有效
- Stage Engine：增加通用的两点图形端点 hit/preview/commit 数据协议；Engine 不认识 Shape 或 SVG，Stage
  adapter 负责将端点坐标映射为 LayoutItem 与 Renderer `direction`。
- 文档模型：不修改现有 v6 Schema。网格间距仍持久化在 canvas；网格显示、当前工具、下拉菜单与视口为会话状态
