/**
 * 「这一帧的 DOM 里该有哪些 Entity」：裁剪窗口的量化与可见集求解。
 *
 * @remarks
 * 本目录的产出**只供渲染使用**。命中、框选、吸附与选区几何一律按文档与布局快照求解，
 * 不得读取这里的结果——见 {@link resolveStageVisibleEntityIds} 的说明。
 */
export * from './viewport-culling'
