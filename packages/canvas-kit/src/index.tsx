/* eslint-disable react-refresh/only-export-components -- 库公共入口必须同时导出标尺组件、视口 Hook 与纯画笔函数。 */
/**
 * 无限画布的共享底座：视口导航、尺寸观测与标尺。
 *
 * @packageDocumentation
 *
 * @remarks
 * 本包只承载**与视口有关**的画布基础设施，不认识任何文档协议、选择集或领域命令。
 *
 * 以下三类**不属于**本包，因为它们正是两个画布**不能**互相复用的原因：
 *
 * - **命中测试**——页面画布按矩形，CAD 按点到几何的距离。把它塞进来等于把那条差异变成
 *   包内的 `if`。
 * - **场景渲染**——DOM 节点 vs SVG 图元。
 * - **手势语义**——页面画布点击替换选择，CAD 点击累加（AutoCAD 约定）。两者相反且都是刻意的。
 *
 * 准入判据统一成一句：**它认识文档或选择集吗？认识就不进。**
 *
 * 无 React 的部分（视口代数、轴点阵、标尺刻度）住在 `@compose-ui/core`：headless 包也要用
 * 它们，而本包以 React 为 peer，反向依赖会造成倒置。
 */

import './styles.css'

export {
  ComposeCanvasRulers,
  paintRuler,
  type ComposeCanvasRulersHandle,
  type ComposeCanvasRulersProps,
  type ComposeRulerPaintInput,
  type ComposeRulerPalette,
} from './ruler'
export {
  useCanvasSurfaceSize,
  type ComposeCanvasSurfaceMeasurement,
  type ComposeCanvasSurfaceSize,
} from './surface-size'
export {
  useCanvasWheelNavigation,
  type ComposeCanvasWheelNavigationParams,
} from './wheel-navigation'

/** `@compose-ui/canvas-kit` 的稳定包标识。 @public */
export const COMPOSE_UI_CANVAS_KIT_PACKAGE = '@compose-ui/canvas-kit' as const
