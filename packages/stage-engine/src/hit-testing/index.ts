/**
 * 「这个点或这个框命中了谁」：场景索引、拖放落点与插入线、框选判定。
 *
 * @remarks
 * 场景索引以隐藏集合的引用为缓存键，宿主必须保证该引用随内容稳定。
 */
export * from './scene-index'
export * from './drop-target'
export * from './marquee-selection'
