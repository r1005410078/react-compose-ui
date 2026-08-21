/**
 * 手势的预览几何与提交规划：变换目标解析、移动落点、绘制约束与 Paint 局部坐标。
 *
 * @remarks
 * 这里的函数被 legacy 单体与插件同时调用过整整一轮绞杀式重构——任何一处规则分叉都会让
 * 同一个手势在两条路径上得到不同结果，因此它们从第一天起就是纯函数。
 */
export * from './transform-planning'
export * from './transform-preview'
export * from './move-planning'
export * from './drawing-tools'
export * from './paint-geometry'
