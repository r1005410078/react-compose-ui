/**
 * 舞台的空间词汇：世界/屏幕/Frame 局部三套坐标、矩阵运算、网格与标尺点阵、吸附与滚动范围。
 *
 * @remarks
 * 标尺与画布网格必须由**同一个点阵**产出——两侧各算一次会产生恒定的亚像素错位，
 * 见 `createAxisLattice` 与 `axis-lattice.test.ts`。
 */
export * from './stage-geometry'
export * from './canvas-geometry'
export * from './frame-space'
