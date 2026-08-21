import type { ComposeEntity } from '@compose-ui/core'

/**
 * 一个 CAD 图层。
 *
 * @remarks
 * 图层是格式的一部分而不是可选功能：AutoCAD 的图层 `0` 永远存在，DXF 的 `LAYER` 表同样
 * 如此。空文档也带一个默认图层。
 *
 * @public
 */
export interface CadLayer {
  /** 文档内唯一的图层 id。 */
  readonly id: string
  /** 面向用户的图层名。 */
  readonly name: string
  /** 图层颜色；图元未显式指定颜色时按此继承（DXF 的 ByLayer）。 */
  readonly color: string
  /** 是否可见。 */
  readonly visible: boolean
  /** 是否锁定，锁定图层上的图元不可编辑。 */
  readonly locked: boolean
}

/**
 * CAD 文档 v1。
 *
 * @remarks
 * 复用 `ComposeEntity` 的 ECS 结构——它本身只要求 `{ id, name, components }`，
 * Composition、Hierarchy 之类的约束住在 ComposeDocument 的**校验器**里而不是类型里。
 * 因此 Patch 代数、事务运行时、Undo/Redo 与序列化全部与 ComposeDocument 共用，差异只在
 * 校验器与 Component 词汇。
 *
 * **没有 Frame，也没有任何画布或输出尺寸**：CAD 是无限图纸。这是「独立文档类型」相对于
 * 「ComposeDocument 里的一种 Entity」的实质收益——后者会被
 * 「`Frame.size` 是尺寸唯一事实来源」这条不变量绑住。
 *
 * @public
 */
export interface CadDocument {
  /** 当前且唯一支持的协议版本。 @defaultValue 1 */
  readonly schemaVersion: 1
  /**
   * 绘图单位。
   *
   * @remarks
   * 固定 `px`，没有图纸比例。目标场景是网络拓扑、一次接线与 PCB 电路原理图，
   * 都是示意图而非按真实尺寸出图的机械 CAD。
   */
  readonly units: 'px'
  /** 至少一个图层，id 在文档内唯一。 */
  readonly layers: readonly CadLayer[]
  /** 顶层绘制顺序；元素必须存在于 `entities`。 */
  readonly rootIds: readonly string[]
  /** 以 Entity 自身 id 为 key。 */
  readonly entities: Readonly<Record<string, ComposeEntity>>
}

/** CAD 文档校验问题的稳定机器码。 @public */
export type CadDocumentIssueCode =
  | 'document.invalid'
  | 'document.unsupported-version'
  | 'document.invalid-units'
  | 'layer.empty'
  | 'layer.invalid'
  | 'layer.duplicate-id'
  | 'entity.invalid'
  | 'entity.id-mismatch'
  | 'document.missing-root'
  | 'document.duplicate-root'
  | 'document.orphan-entity'
  | 'entity.missing-layer'
  | 'entity.invalid-geometry'

/** 一条 CAD 文档校验问题。 @public */
export interface CadDocumentIssue {
  readonly code: CadDocumentIssueCode
  readonly path: readonly (string | number)[]
  readonly message: string
}

/** 默认图层的稳定 id；与 AutoCAD 的图层 `0` 对齐。 @public */
export const CAD_DEFAULT_LAYER_ID = '0'
