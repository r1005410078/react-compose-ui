/**
 * AutoCAD 风格的 CAD 编辑画布：SVG 图面 + 命令行。
 *
 * @remarks
 * **命令由键盘启动**——键入 `L↵` 开始画线，随后画布上的点击成为命令的一步输入。本包不理解
 * 任何命令有几步：状态机住在 `@compose-ui/cad`，多步提示协议住在 `@compose-ui/commands`。
 *
 * 无限图纸：滚轮缩放、中键平移，没有画布边界。视口换算目前只服务本包内部，因此不进公共入口。
 *
 * @packageDocumentation
 */

import './styles.css'

export { ComposeCadCanvas, type ComposeCadCanvasProps } from './compose-cad-canvas'
