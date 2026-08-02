# Paint v5 设计

## 值模型与渲染

`ComposePaint` 是严格 JSON：Solid 只保存规范 ComposeColor；三种 Gradient 保存 2–8 个具有稳定 ID 的 stop 以及归一化局部几何。v5 不接收 v4 或 Appearance.backgroundColor，避免双事实来源。

Core 提供校验、规范化、stop 插值、局部点采样和无 React 的 Paint render descriptor。Component Registry 以唯一 `ComposeEntityPaintLayer` 渲染 descriptor：Linear/Radial 使用受控 SVG，Angular 使用受控 CSS conic gradient，Solid 使用 CSS 背景。Stage 与 Preview 必须复用同一 layer。

## 交互与端口

Stage Engine context 只接收普通 JSON `paintEditing` target；snapshot 输出 paint preview、overlay 几何和 sample hover。pointer move 只改变 snapshot；pointer up 使用现有 command effect 生成一个 setAppearance。

Component Registry 定义纯 `ComposePaintEditPort`，Inspector 通过它激活/关闭背景 Paint 编辑或请求 Stage 采样；Editor 持有该会话并把它映射为 ComposeStage 受控 props。Materials 不导入 Editor 或 Stage。

## 取色

Picker 在安全上下文和可用浏览器中从用户手势调用 native EyeDropper；AbortSignal、Escape、卸载和字段切换均取消请求。不可用、拒绝或失败时 port 启动 Stage sample session：普通点击以命中 entity 的局部点求最终 Paint 颜色，Alt/Option 点击复制完整 backgroundPaint。无法从图片、SVG 或未知 Renderer 求值时保持原值并显示状态。

## 视觉与可访问性

Paint Picker 是 368–400px 的 Shadcn/Base UI Popover。默认显示类型、stop、色盘、Hue、Alpha、透明、最近/常用色；精确输入折叠。编辑启用时 Popover 处于 pinned 状态，画布控制柄只在单个目标实体上显示。SVG 控制柄提供可聚焦的 slider/button 语义、明确标签、Arrow 1%、Shift+Arrow 10%、Home/End 以及焦点环。
