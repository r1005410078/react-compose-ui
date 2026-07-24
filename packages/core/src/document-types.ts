/**
 * JSON 中允许的标量。
 *
 * @public
 */
export type JsonPrimitive = null | boolean | number | string

/**
 * 可被 ComposeDocument、命令和 Patch 安全持久化的 JSON 值。
 *
 * @public
 */
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue }

/**
 * 以字符串键组织的 JSON 对象。
 *
 * @public
 */
export interface JsonObject {
  readonly [key: string]: JsonValue
}

/**
 * 节点相对直接父节点的二维几何。
 *
 * @remarks
 * 无限 Stage 允许负坐标。宽高必须为有限正数；Frame 的 rotation 必须为零。
 *
 * @public
 */
export interface NodeTransform {
  /** 相对父节点左上角的水平坐标。 */
  readonly x: number
  /** 相对父节点左上角的垂直坐标。 */
  readonly y: number
  /** 节点自身坐标系中的宽度。 */
  readonly width: number
  /** 节点自身坐标系中的高度。 */
  readonly height: number
  /** 顺时针旋转角度，单位为度。 */
  readonly rotation: number
}

/**
 * 所有 ComposeDocument 节点共享的字段。
 *
 * @public
 */
export interface ComposeNodeBase {
  /** 文档内稳定且唯一的节点 ID。 */
  readonly id: string
  /** 面向编辑器用户的节点名称。 */
  readonly name: string
  /** 节点及其后代是否可见。 */
  readonly visible: boolean
  /** 节点是否禁止结构和几何编辑。 */
  readonly locked: boolean
  /** 相对直接父节点的二维几何。 */
  readonly transform: NodeTransform
}

/**
 * 无限 Stage 中定义预览输出边界的根节点。
 *
 * @public
 */
export interface ComposeFrameNode extends ComposeNodeBase {
  readonly kind: 'frame'
  /** 按场景顺序排列的直接子节点 ID。 */
  readonly childIds: readonly string[]
}

/**
 * 用于组织后代并承载局部坐标系的分组节点。
 *
 * @public
 */
export interface ComposeGroupNode extends ComposeNodeBase {
  readonly kind: 'group'
  /** 按场景顺序排列的直接子节点 ID。 */
  readonly childIds: readonly string[]
}

/**
 * 由宿主运行时注册表负责渲染的组件节点。
 *
 * @public
 */
export interface ComposeComponentNode extends ComposeNodeBase {
  readonly kind: 'component'
  /** 解析宿主 ComponentDefinition 的稳定类型。 */
  readonly componentType: string
  /** 严格 JSON 可序列化的组件属性。 */
  readonly props: JsonObject
}

/**
 * ComposeDocument 支持的节点联合。
 *
 * @public
 */
export type ComposeNode =
  | ComposeFrameNode
  | ComposeGroupNode
  | ComposeComponentNode

/**
 * 编辑器、Stage 与 Preview 共享的首版正式文档。
 *
 * @public
 */
export interface ComposeDocument {
  /** 当前文档协议版本。 @defaultValue 1 */
  readonly schemaVersion: 1
  /** 按世界场景顺序排列的 Frame ID。 */
  readonly rootIds: readonly string[]
  /** 以稳定 ID 规范化保存的全部节点。 */
  readonly nodes: Readonly<Record<string, ComposeNode>>
}

/**
 * 文档校验问题的稳定机器码。
 *
 * @public
 */
export type DocumentValidationIssueCode =
  | 'json.unsupported'
  | 'json.non-finite-number'
  | 'json.cycle'
  | 'document.invalid'
  | 'document.unsupported-version'
  | 'document.invalid-root'
  | 'document.invalid-root-kind'
  | 'document.duplicate-root'
  | 'document.missing-child'
  | 'document.multiple-parents'
  | 'document.cycle'
  | 'document.orphan-node'
  | 'document.invalid-child-kind'
  | 'node.invalid'
  | 'node.id-mismatch'
  | 'node.invalid-field'
  | 'transform.non-finite'
  | 'transform.invalid-size'
  | 'transform.frame-rotation'
  | 'component.empty-type'

/**
 * 一个可定位的文档校验问题。
 *
 * @public
 */
export interface DocumentValidationIssue {
  /** 供程序判断的稳定错误码。 */
  readonly code: DocumentValidationIssueCode
  /** 从文档根开始定位问题的字符串/数组索引路径。 */
  readonly path: readonly (string | number)[]
  /** 面向开发者的简短错误说明。 */
  readonly message: string
}

/**
 * 文档校验的判别结果。
 *
 * @public
 */
export type DocumentValidationResult =
  | { readonly valid: true; readonly document: ComposeDocument }
  | { readonly valid: false; readonly issues: readonly DocumentValidationIssue[] }
