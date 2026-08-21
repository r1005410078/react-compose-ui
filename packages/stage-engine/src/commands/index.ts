/**
 * 空间命令的规划：层级顺序、编组、剪贴板、组件提取、新场景落位与事务标签。
 *
 * @remarks
 * 这一层只**规划**命令，不派发也不写文档；可用性判定与命令构造成对出现，
 * 便于宿主先问「能不能做」再决定是否给出入口。
 */
export * from './structure-commands'
export * from './clipboard'
export * from './component-extraction'
export * from './entity-placement'
export * from './transaction-labels'
