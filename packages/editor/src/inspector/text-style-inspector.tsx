import { useId, useState } from 'react'
import { ComposeConfirmDialog } from '@compose-ui/components'
import {
  BUILTIN_COMMAND_TYPES,
  getComposeRenderer,
  getComposeStyleRef,
  getComposeTextStyleState,
  getComposeTextStyles,
  planComposeApplyTextStyle,
  planComposeDetachTextStyle,
  resolveComposeStyles,
  type ComposeDocument,
  type ComposeEntity,
  type EditorCommand,
  type JsonObject,
} from '@compose-ui/core'

/**
 * 一条样式管辖哪几个排版字段。
 *
 * @remarks
 * 提取样式时按这份清单取值。**不取全部 props**：`text` 是这一条文字自己的内容，把它收进样式
 * 会让所有跟随者显示同一句话——那不是样式，那是复制。
 *
 * 这份清单与 Text 物料的排版分组是同一组字段，但**故意不从物料读**：`editor` 不依赖
 * `materials`，而按 Renderer 类型分派会让每加一种带排版的物料都要回来改一次。
 */
const GOVERNED_PROPS = [
  'fontSize',
  'fontFamily',
  'fontWeight',
  'letterSpacing',
  'lineHeight',
  'color',
  'textAlign',
  'textCase',
  'textDecoration',
] as const

/**
 * 选区里各自跟着不同样式时，下拉框的取值。
 *
 * @remarks
 * **混合与「不跟随」必须是两个值**：后者是一条能派发的命令（脱离），把混合也画成那个空选项
 * 会让用户读成「这一批已经都不跟随了」，而事实是其中几条正跟着样式。与导线绑定三态、与样式
 * 引用的 `none` / `bound` / `dangling` 是同一条判断。
 *
 * 取一个样式 id 不可能取到的值：样式 id 由 `style-` 前缀加 id 工厂产出。
 */
const MIXED_VALUE = '__mixed__'

function governedValues(entity: ComposeEntity | undefined): JsonObject {
  const props = (entity ? getComposeRenderer(entity)?.props : undefined) ?? {}
  return Object.fromEntries(
    GOVERNED_PROPS.flatMap((name) => (name in props ? [[name, props[name]]] : [])),
  )
}

/** 数一条样式在整份文档里有几处跟随者；删除确认要把这个数说出来。 @internal */
function countFollowers(document: ComposeDocument, styleId: string) {
  return Object.values(document.entities)
    .filter((entity) => getComposeStyleRef(entity)?.text === styleId).length
}

/** 样式分组的文案；与 editor 其余部分一样按 locale 二选一，不引第三份 i18n。 @internal */
function text(zh: boolean, en: string, cn: string) {
  return zh ? cn : en
}

/**
 * 样式名称编辑器。
 *
 * @remarks
 * 独立出来只为一件事：草稿状态按 `key={styleId}` 重挂载。写成父组件里的一个 `useState` 就要
 * 配一个「样式换了就重置草稿」的 effect，而那种同步在用户正打字时把字吃掉——切换选中的样式
 * 与正在编辑的名称是两件事，让 React 按 key 重建比自己同步可靠。
 *
 * 重命名走的是 `document.style.text.set` 这条 **upsert**：同一个 id、新的 name、原样的 props。
 * 它不是第二条命令词——「新建」与「改写」的载荷逐字相同，差别只是这个 id 在不在。
 *
 * @internal
 */
function StyleNameEditor({
  disabled,
  name,
  zh,
  onRename,
}: {
  readonly disabled: boolean
  readonly name: string
  readonly zh: boolean
  readonly onRename: (next: string) => void
}) {
  const [draft, setDraft] = useState(name)
  const commit = () => {
    const next = draft.trim()
    // 空名称非法（命令会拒），而拒绝之后输入框里留着空串比退回原名更难理解。
    if (next.length === 0 || next === name) {
      setDraft(name)
      return
    }
    onRename(next)
  }
  return (
    <div className="text-style-inspector__rename">
      <input
        aria-label={text(zh, 'Style name', '样式名称')}
        disabled={disabled}
        value={draft}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          }
          if (event.key === 'Escape') setDraft(name)
        }}
      />
    </div>
  )
}

/**
 * 文字样式分组。
 *
 * @remarks
 * 只在这个 Entity 有 Renderer 时出现——样式管的是排版值，而容器没有 props 可管。
 *
 * 它**不是**一个独立面板：样式的三件事（提取、应用、脱离）都以「当前选中的这一条」为对象，
 * 放进 Inspector 才与它作用的东西在同一处；独立面板要另建一套选区通道。
 *
 * **选区是一个数组，单选是它恰好一个成员的退化情形**——与时间线的关键帧选区是同一条判断。
 * 应用、脱离、重命名与删除四件事在多选下逐字成立（规划器本来就按 `entityIds` 收数组）；
 * 提取与写回**只在单选下出现**，它们要从「这一条」取值，而多选没有「这一条」。
 *
 * @internal
 */
export function TextStyleInspector({
  document,
  entities,
  dispatch,
  idFactory,
  readOnly,
  zh,
}: {
  readonly document: ComposeDocument
  /** 作用对象；单选即长度为一。 */
  readonly entities: readonly ComposeEntity[]
  readonly dispatch: (command: EditorCommand) => unknown
  readonly idFactory: () => string
  readonly readOnly: boolean
  readonly zh: boolean
}) {
  const selectId = useId()
  const styles = getComposeTextStyles(document)
  const entries = Object.entries(styles)
  const [draftName, setDraftName] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const single = entities.length === 1 ? entities[0] : undefined
  const entityIds = entities.map((entity) => entity.id)
  /*
   * 选区里的样式引用收成一个集合：恰好一个值时那就是「这一批跟的样式」（`undefined` 即整批
   * 都不跟随），多于一个即混合。
   */
  const refs = new Set(entities.map((entity) => getComposeStyleRef(entity)?.text))
  const mixed = refs.size > 1
  const currentId = mixed ? undefined : [...refs][0]
  const danglingCount = entities.filter(
    (entity) => getComposeTextStyleState(document, entity) === 'dangling',
  ).length
  const boundStyle = currentId === undefined ? undefined : styles[currentId]

  const apply = (styleId: string) => {
    const command = planComposeApplyTextStyle({ document, entityIds, styleId, idFactory })
    if (command) dispatch(command)
  }

  const detach = () => {
    const command = planComposeDetachTextStyle({ document, entityIds, idFactory })
    if (command) dispatch(command)
  }

  /*
   * 提取：先写下样式，再把这一条应用上去。两条命令而不是一个 batch——样式表写入与 Entity
   * 写入是两件可以分别撤销的事，而用户对「我建了一条样式」与「我把它用上了」也确实有两步的
   * 预期。
   */
  const extract = () => {
    const name = draftName.trim()
    if (name.length === 0 || !single) return
    const styleId = `style-${idFactory()}`
    const props = governedValues(single)
    dispatch({
      id: idFactory(),
      type: BUILTIN_COMMAND_TYPES.setTextStyle,
      payload: { styleId, name, props },
      meta: { label: `Create style ${name}`, source: 'inspector' },
    })
    /*
     * 规划应用时把刚写下的这条样式**先补进文档的副本**：`document` 是本次渲染拿到的那一份，
     * 上一条命令还没回到这里。不补的话规划器查不到这个 id、交回 null，症状是「提取了，
     * 但这一条没跟上」——样式建出来了，选中它的那一步却没发生。
     */
    const command = planComposeApplyTextStyle({
      document: { ...document, styles: { ...styles, [styleId]: { name, props } } },
      entityIds: [single.id],
      styleId,
      idFactory,
    })
    if (command) dispatch(command)
    setDraftName('')
  }

  /*
   * 「把这一条写回样式」：跟随者上的本地覆盖是「只改这一条」，而用户常常是想让所有跟随者
   * 一起变——两个意图必须各有一个入口，否则改一次就得撤销再走另一条路。取的是**解析之后**
   * 的值：那正是屏幕上此刻的样子。
   */
  const pushToStyle = () => {
    if (currentId === undefined || !boundStyle || !single) return
    const resolved = resolveComposeStyles(document).entities[single.id]
    dispatch({
      id: idFactory(),
      type: BUILTIN_COMMAND_TYPES.setTextStyle,
      payload: { styleId: currentId, name: boundStyle.name, props: governedValues(resolved) },
      meta: { label: `Update style ${boundStyle.name}`, source: 'inspector' },
    })
    // 写回之后这一条不该再留本地覆盖，否则它与样式的值重复，改样式时它又不跟。
    const command = planComposeApplyTextStyle({
      document, entityIds: [single.id], styleId: currentId, idFactory,
    })
    if (command) dispatch(command)
  }

  const rename = (next: string) => {
    if (currentId === undefined || !boundStyle) return
    dispatch({
      id: idFactory(),
      type: BUILTIN_COMMAND_TYPES.setTextStyle,
      payload: { styleId: currentId, name: next, props: boundStyle.props },
      meta: { label: `Rename style ${next}`, source: 'inspector' },
    })
  }

  /*
   * 删除只删样式表里那一条，**不追着去解除跟随者的引用**：那些引用变成悬空，各自保留自己
   * 写下的值照常渲染。代价要在确认框里说出来——被管辖的那几个字段在「应用」时就已经从跟随者
   * 身上删掉了，因此删掉样式之后它们会回到 Renderer 的默认排版，这是一次看得见的外观改动。
   */
  const remove = (styleId: string) => {
    dispatch({
      id: idFactory(),
      type: BUILTIN_COMMAND_TYPES.removeTextStyle,
      payload: { styleId },
      meta: { label: 'Remove style', source: 'inspector' },
    })
    /*
     * 确认框自己不关：`ComposeConfirmDialog` 的 `onConfirm` 只是一次点击回调，开合仍归调用方
     * 的那份状态。不清的症状是删除确实发生了、框却留在屏幕上——而它是模态的，此后整个编辑器
     * 都点不动，看起来像是「删除把编辑器卡死了」。
     */
    setPendingDelete(null)
  }

  if (entities.length === 0) return null

  const pendingStyle = pendingDelete === null ? undefined : styles[pendingDelete]
  const pendingFollowers = pendingDelete === null ? 0 : countFollowers(document, pendingDelete)

  return (
    <div className="text-style-inspector">
      {danglingCount > 0 ? (
        <p className="text-style-inspector__dangling" role="status">
          {single
            ? text(zh, 'The linked style no longer exists; local values are used.',
              '跟随的样式已不存在，当前用的是这一条自己的值')
            : text(zh, `${danglingCount} of the selection link to a style that no longer exists.`,
              `选中的 ${danglingCount} 条跟随的样式已不存在`)}
        </p>
      ) : null}
      <label htmlFor={selectId}>
        {text(zh, 'Text style', '文字样式')}
        <select
          disabled={readOnly || entries.length === 0}
          id={selectId}
          value={mixed ? MIXED_VALUE : currentId ?? ''}
          onChange={(event) => {
            const next = event.target.value
            if (next === '') detach()
            else if (next !== MIXED_VALUE) apply(next)
          }}
        >
          {mixed ? (
            <option disabled value={MIXED_VALUE}>{text(zh, 'Mixed', '多种样式')}</option>
          ) : null}
          <option value="">{text(zh, 'None', '不跟随')}</option>
          {entries.map(([id, style]) => (
            <option key={id} value={id}>{style.name}</option>
          ))}
        </select>
      </label>

      {boundStyle && currentId !== undefined ? (
        <>
          <StyleNameEditor
            disabled={readOnly}
            key={currentId}
            name={boundStyle.name}
            zh={zh}
            onRename={rename}
          />
          <div className="text-style-inspector__manage">
            <button
              disabled={readOnly}
              type="button"
              onClick={() => setPendingDelete(currentId)}
            >
              {text(zh, 'Delete style', '删除样式')}
            </button>
          </div>
        </>
      ) : null}

      {currentId === undefined && !mixed && single ? (
        <div className="text-style-inspector__extract">
          <input
            aria-label={text(zh, 'New style name', '新样式名称')}
            disabled={readOnly}
            placeholder={text(zh, 'New style name', '新样式名称')}
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              extract()
            }}
          />
          <button
            disabled={readOnly || draftName.trim().length === 0}
            type="button"
            onClick={extract}
          >
            {text(zh, 'Extract style', '提取为样式')}
          </button>
        </div>
      ) : null}

      {currentId !== undefined || mixed ? (
        <div className="text-style-inspector__actions">
          {single ? (
            <button
              disabled={readOnly || boundStyle === undefined}
              type="button"
              onClick={pushToStyle}
            >
              {text(zh, 'Push to style', '把这一条写回样式')}
            </button>
          ) : null}
          <button disabled={readOnly} type="button" onClick={detach}>
            {single
              ? text(zh, 'Detach', '脱离样式')
              : text(zh, 'Detach all', '全部脱离样式')}
          </button>
        </div>
      ) : null}

      {/*
        * 多选下没有「提取」与「写回」：两者都要从**一条**的当前值取排版，而多选没有「这一条」。
        * 说出来而不是静默少两颗按钮——少掉的入口用户读不出原因。
        */}
      {!single ? (
        <p className="text-style-inspector__hint">
          {text(zh, 'Extracting and pushing take a single object; select one.',
            '提取与写回以单条为对象，先只选中一条')}
        </p>
      ) : null}

      <ComposeConfirmDialog
        cancelLabel={text(zh, 'Cancel', '取消')}
        confirmLabel={text(zh, 'Delete', '删除')}
        description={text(
          zh,
          `“${pendingStyle?.name ?? ''}” is followed by ${pendingFollowers} object(s); they fall back to the renderer defaults.`,
          `“${pendingStyle?.name ?? ''}”正被 ${pendingFollowers} 处跟随，删除后它们会回到默认排版。`,
        )}
        destructive
        open={pendingDelete !== null}
        title={text(zh, 'Delete style?', '删除样式？')}
        onConfirm={() => {
          if (pendingDelete !== null) remove(pendingDelete)
        }}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      />
    </div>
  )
}
