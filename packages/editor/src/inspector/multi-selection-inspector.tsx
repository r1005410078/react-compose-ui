import {
  findComposeMixedRendererProps,
  getComposeLock,
  getComposeRenderer,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
  type EditorCommand,
} from '@compose-ui/core'
import {
  ComposeRegistryRendererInspector,
  type ComposeEntityRegistry,
  type ComposeNodeEditPort,
  type ComposePaintEditPort,
} from '@compose-ui/component-registry'
import {
  ComposePropertyPanelRoot,
  ComposePropertyPanelSection,
} from '@compose-ui/property-panel'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { DefaultEmptyInspector } from './empty-inspector'
import { TextStyleInspector } from './text-style-inspector'

/**
 * 选区里共有的那一个 Renderer。
 *
 * @remarks
 * **不按 prop 名跨 Renderer 类型取交集**：文字的 `color` 与曲线的 `stroke` 不是一件事，而
 * 同名不同义的两个 prop 收进同一个字段，用户读不出自己在改谁；字段的标签、编辑器与选项文案
 * 也都出自某一个物料自己的 Inspector，跨类型时根本没有一份可用的。
 *
 * 因此判据是「这一批是不是同一种 Renderer」——是，就把那个物料自己的 Inspector 原样搬过来，
 * 字段与单选逐字相同；不是，退回空态。
 */
/**
 * 这个 Entity 锁没锁。
 *
 * @remarks
 * `Lock` 是基础 Component，但多选面板不该因为一份缺它的文档整个崩掉——读不到就按「没锁」走，
 * 与规划那一层的判断一致。
 */
function isLocked(entity: ComposeEntity): boolean {
  return getComposeLock(entity)?.locked === true
}

function sharedRendererType(entities: readonly ComposeEntity[]): string | undefined {
  const types = new Set(entities.map((entity) => getComposeRenderer(entity)?.type))
  if (types.size !== 1) return undefined
  const [type] = [...types]
  return type ?? undefined
}

/**
 * 多选时的 Inspector。
 *
 * @remarks
 * **作用对象是选区，单选是它恰好一个成员的退化情形**——与时间线的关键帧选区、文字样式的四件
 * 事是同一条判断，这是它的第三次应用。
 *
 * 选区里带同一种 Renderer 时渲染那个物料自己的 Inspector：字段、编辑器与分组与单选逐字相同，
 * 写入作用于整批。取值不一致的字段由 `mixedPropNames` 报上去，属性面板标成「多个值」——
 * MUST NOT 拿其中一条的值冒充整批。
 *
 * **锁定的成员不被写入，并且说出来**：规划那一层已经把它们挡掉了，而静默跳过会让用户以为写
 * 进去了。全部锁定时整段只读。
 *
 * 文字样式那一段照旧：它管的是排版值，作用对象同样是选区，与 Renderer 是哪一种无关。
 *
 * @internal
 */
export function MultiSelectionInspector({
  document,
  selectedIds,
  dispatch,
  idFactory,
  registry,
  layoutSnapshot,
  nodeEditPort,
  paintEditPort,
  readOnly = false,
}: {
  readonly document: ComposeDocument
  readonly selectedIds: readonly string[]
  readonly dispatch: (command: EditorCommand) => unknown
  readonly idFactory: () => string
  /** 缺席时不出 Renderer 分组——没有 Registry 就没有那个物料的 Inspector。 */
  readonly registry?: ComposeEntityRegistry
  readonly layoutSnapshot?: ComposeLayoutSnapshot
  readonly nodeEditPort?: ComposeNodeEditPort
  readonly paintEditPort?: ComposePaintEditPort
  readonly readOnly?: boolean
}) {
  const i18n = useComposeI18nContext()
  const zh = (i18n?.locale ?? 'zh-CN') === 'zh-CN'
  const entities = selectedIds
    .flatMap((id) => {
      const entity = document.entities[id]
      return entity && getComposeRenderer(entity) ? [entity] : []
    })
  const rendererType = sharedRendererType(entities)
  const definition = rendererType && registry ? registry.getRenderer(rendererType) : undefined
  const lockedCount = entities.filter(isLocked).length
  const allLocked = entities.length > 0 && lockedCount === entities.length
  /*
   * 只比 Contract 列出的那些：面板要问的是「我画出来的这几个字段里哪些不是单值」，而不是
   * 「这几个对象的 props 有什么区别」——后者会把物料没画出来的内部 prop 也报成混合。
   */
  const mixedPropNames = definition
    ? findComposeMixedRendererProps({
        document,
        entityIds: entities.map((entity) => entity.id),
        propNames: (definition.propContracts ?? []).map((contract) => contract.name),
      })
    : undefined
  const categories = definition?.propCategories ?? []

  const rendererSections = definition ? (
    <>
      {lockedCount > 0 ? (
        <p className="compose-editor__multi-inspector-locked" role="status">
          {zh
            ? `选中的 ${lockedCount} 条已锁定，不会被写入`
            : `${lockedCount} locked object(s) in the selection will not be written`}
        </p>
      ) : null}
      {categories.length > 0 ? categories.map((category) => (
        <ComposePropertyPanelSection
          defaultExpanded={category.inspectorDefaultExpanded ?? true}
          key={`renderer-category:${category.id}`}
          title={category.label}
        >
          <ComposeRegistryRendererInspector
            dispatch={dispatch}
            document={document}
            entities={entities}
            entity={entities[0]!}
            layoutSnapshot={layoutSnapshot}
            mixedPropNames={mixedPropNames}
            nodeEditPort={nodeEditPort}
            paintEditPort={paintEditPort}
            propCategory={category}
            readOnly={readOnly || allLocked}
            registry={registry!}
          />
        </ComposePropertyPanelSection>
      )) : (
        <ComposePropertyPanelSection
          defaultExpanded
          title={zh ? '高级' : 'Advanced'}
        >
          <ComposeRegistryRendererInspector
            dispatch={dispatch}
            document={document}
            entities={entities}
            entity={entities[0]!}
            layoutSnapshot={layoutSnapshot}
            mixedPropNames={mixedPropNames}
            nodeEditPort={nodeEditPort}
            paintEditPort={paintEditPort}
            readOnly={readOnly || allLocked}
            registry={registry!}
          />
        </ComposePropertyPanelSection>
      )}
    </>
  ) : null

  return (
    <div className="compose-editor__multi-inspector">
      {/*
        * 没有共有 Renderer 时仍然是今天那句空态：混合类型下没有一个字段的含义是确定的。
        */}
      {definition ? null : <DefaultEmptyInspector multiple />}
      {definition ? (
        <ComposePropertyPanelRoot
          aria-label={zh
            ? `${entities.length} 个对象的属性字段`
            : `Property fields of ${entities.length} objects`}
        >
          {rendererSections}
        </ComposePropertyPanelRoot>
      ) : null}
      {/*
        * 样式这一段留在面板根之外的普通 section 里，与本变更之前逐字相同：收起的分组会**卸载**
        * 子节点，把它挪进一个默认收起的分组等于让这条能力在多选下消失一层——而它此前一直是
        * 直接可见的。
        */}
      {entities.length > 0 ? (
        <section aria-label={zh ? '文字样式' : 'Text style'}>
          <h3>{zh ? '文字样式' : 'Text style'}</h3>
          <TextStyleInspector
            dispatch={dispatch}
            document={document}
            entities={entities}
            idFactory={idFactory}
            readOnly={readOnly || allLocked}
            zh={zh}
          />
        </section>
      ) : null}
    </div>
  )
}
