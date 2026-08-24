import type {
  ComposeDocument,
  ComposeEntity,
  ComposePosition,
  ComposeSize,
  JsonObject,
} from '@compose-ui/core'
import type { DxfDiagnostic } from '../parser/dxf-diagnostics'

/**
 * 一份 Preset seed。
 *
 * @remarks
 * 结构化声明而不是从 `@compose-ui/component-registry` 引入：本包只依赖 `core`，Registry 的
 * `ComposeEntitySeed` 结构上可直接传进来。
 * @public
 */
export interface DxfEntitySeed {
  readonly name: string
  readonly components: Readonly<Record<string, JsonObject>>
}

/** 按 Preset id 取一份 seed；取不到时返回 null，该实体连同诊断一起跳过。 @public */
export type DxfCreateSeed = (presetId: string) => DxfEntitySeed | null

/** 一个块映射出的组件计划。 @public */
export interface DxfComponentPlan {
  /** DXF 里的块名；宿主用它作为组件名与文件名。 */
  readonly blockName: string
  /** 组件文档，根是 Frame。 */
  readonly document: ComposeDocument
}

/**
 * 一次 INSERT 映射出的实例计划。
 *
 * @remarks
 * 实例 Entity 本身不在计划里：它需要资源引用与 revision，而那些要等组件文件写完才存在。
 * 宿主写完文件、建好实例 Entity 之后交给 {@link assembleDxfDocument}。
 * @public
 */
export interface DxfInstancePlan {
  readonly id: string
  readonly blockName: string
  /** 场景局部坐标下的盒左上角。 */
  readonly offset: ComposePosition
  readonly rotation: number
  /**
   * 旋转基点，**归一化盒坐标**。
   *
   * @remarks
   * DXF 的块基点常落在块几何之外（接线端子的基点就在图形外侧的接线点上），因此这个值可以
   * 落在 `[0, 1]` 之外——`Transform.pivot` 不钳制正是为这种情形留的口子。
   */
  readonly pivot: ComposePosition
}

/** 场景计划：不含实例 Entity，但 `childIds` 里已经排好它们的位置。 @public */
export interface DxfScenePlan {
  readonly frameId: string
  readonly size: ComposeSize
  /** 含场景 Frame 自身，不含任何组件实例。 */
  readonly entities: Readonly<Record<string, ComposeEntity>>
  /** 场景子级顺序，含实例 id。 */
  readonly childIds: readonly string[]
}

/** 一次 DXF 导入的完整计划。 @public */
export interface DxfImportPlan {
  readonly scene: DxfScenePlan
  readonly components: readonly DxfComponentPlan[]
  readonly instances: readonly DxfInstancePlan[]
  readonly diagnostics: readonly DxfDiagnostic[]
}
