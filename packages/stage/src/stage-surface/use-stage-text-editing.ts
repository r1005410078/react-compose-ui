import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import {
  BUILTIN_COMMAND_TYPES,
  getComposeLock,
  getComposeRenderer,
  type ComposeDocument,
  type JsonValue,
} from '@compose-ui/core'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type { ComposeRendererMeasurementAdapter } from '@compose-ui/component-registry'
import { describeEntityTargets } from '@compose-ui/stage-engine'
import type { ComposeStageDispatch } from '../types'

/** 读取 Entity 当前 authored 的可编辑纯文本；不可编辑或缺失时返回空串。 */
export function entityEditableText(
  value: ComposeDocument,
  registry: ComposeEntityRegistry,
  entityId: string,
) {
  const entity = value.entities[entityId]
  if (!entity) return ''
  const propName = registry.getEditableTextPropName(entity)
  if (propName === null) return ''
  const current = getComposeRenderer(entity)?.props[propName]
  return typeof current === 'string' ? current : String(current ?? '')
}

/** 原地文字编辑能力的依赖清单。 */
export interface StageTextEditingParams {
  readonly document: ComposeDocument
  readonly registry: ComposeEntityRegistry
  readonly dispatch: ComposeStageDispatch
  readonly idFactory: () => string
  /** 测量适配器；编辑中的文本通过它进入测量链路，使 Auto width 实时改宽。 */
  readonly measurementAdapter: ComposeRendererMeasurementAdapter
  /**
   * 把焦点交还画布。
   *
   * @remarks
   * 退出编辑必须调用，否则编辑元素卸载后焦点落到 body，后续快捷键全部失效。
   */
  readonly restoreFocus: () => void
}

/** 原地文字编辑能力的出口。 */
export interface StageTextEditing {
  /** 当前编辑会话；`null` 表示不在编辑态。会话进出很少，因此用 state 驱动渲染。 */
  readonly session: { readonly entityId: string } | null
  /**
   * 编辑目标当前 authored 的文本；不在编辑态时为 null。
   *
   * @remarks
   * 只播种 authored 值，不回传编辑中的文本：后者放在 ref 里，既避免每个字符重建整棵
   * Scene，也避免 Auto width 重排引起的重渲染把用户刚敲的内容覆盖回旧值。
   */
  readonly authoredText: string | null
  /** 是否正在编辑；供其他能力（如键盘 Esc 分支）判定。 */
  readonly isEditing: () => boolean
  /** 目标是否可进入原地编辑；锁定或无可编辑文本 Prop 的都不行。 */
  readonly isTextEditable: (entityId: string) => boolean
  /** 内容是否随宽度回流；引擎据此决定缩放时要不要重新测量。 */
  readonly contentReflowsWithWidth: (entityId: string) => boolean
  readonly enterTextEditing: (entityId: string) => void
  readonly changeTextEditing: (value: string) => void
  readonly exitTextEditing: () => void
}

/**
 * 「用户在画布上原地改文字」这条能力。
 *
 * @remarks
 * 状态分成两半，各有理由：会话身份（在编辑谁）进 state，因为它要驱动渲染且变化很少；
 * **编辑中的文本只进 ref**——每敲一个字符就 setState 会让整棵 Scene 重建，而文本本就由
 * contentEditable 的 DOM 拥有。ref 里的 `text` 为 `null` 表示「进入编辑后一个字都没敲」，
 * 与「改成了空串」是两件事，退出时的处理也不同。
 *
 * 依赖逐项接收，但内部自持一份「最新值」ref：几个回调必须引用稳定，而稳定回调又必须读到
 * 最新文档。这份 ref 是本 Hook 的实现细节，不出现在签名里。
 *
 * **引用稳定不是性能优化，是正确性要求**：`enterTextEditing` / `exitTextEditing` 进宿主的
 * 效果处理表，该表随引用变化重建会打断进行中的手势（线段端点、框选、路径顶点会被判成
 * 上下文已变而 cancel）。因此连 `restoreFocus` 这样的宿主回调也从 ref 里读，不进依赖数组。
 */
export function useStageTextEditing(params: StageTextEditingParams): StageTextEditing {
  const { measurementAdapter } = params
  const latestRef = useRef(params)
  useLayoutEffect(() => {
    latestRef.current = params
  })

  const [session, setSession] = useState<{ readonly entityId: string } | null>(null)
  const sessionRef = useRef<{ readonly entityId: string; text: string | null } | null>(null)

  const isTextEditable = useCallback((entityId: string) => {
    const { document, registry } = latestRef.current
    const entity = document.entities[entityId]
    if (!entity || getComposeLock(entity).locked) return false
    return registry.getEditableTextPropName(entity) !== null
  }, [])

  const contentReflowsWithWidth = useCallback((entityId: string) => {
    const { document, registry } = latestRef.current
    const entity = document.entities[entityId]
    return entity ? registry.getContentReflowsWithWidth(entity) : false
  }, [])

  const enterTextEditing = useCallback((entityId: string) => {
    if (!isTextEditable(entityId)) return
    sessionRef.current = { entityId, text: null }
    setSession({ entityId })
  }, [isTextEditable])

  const changeTextEditing = useCallback((value: string) => {
    const current = sessionRef.current
    if (!current) return
    current.text = value
    // 只更新运行时覆盖，不派发任何文档命令；覆盖让渲染与测量看到同一个值，
    // Auto width 据此经既有 measurement 失效链路实时改宽。
    measurementAdapter.setEditableTextOverride(current.entityId, value)
  }, [measurementAdapter])

  /**
   * 结束会话并按内容收敛为最多一条事务。
   *
   * @remarks
   * 编辑期间不产生任何事务——逐字符提交会让历史被单个单词撑满，`Ctrl+Z` 也退化成逐字符
   * 回退。因此提交只发生在这里，且三种情况互斥：有变化写 Prop、为空删实体、无变化不发命令。
   */
  const exitTextEditing = useCallback(() => {
    const current = sessionRef.current
    if (!current) return
    sessionRef.current = null
    setSession(null)
    measurementAdapter.setEditableTextOverride(current.entityId, null)
    const { dispatch, document, idFactory, registry, restoreFocus } = latestRef.current
    restoreFocus()
    const entity = document.entities[current.entityId]
    if (!entity) return
    const propName = registry.getEditableTextPropName(entity)
    if (propName === null) return
    const renderer = getComposeRenderer(entity)
    const previous = renderer?.props[propName]
    const previousText = typeof previous === 'string' ? previous : String(previous ?? '')
    // text 为 null 表示一个字都没敲；此时当前内容就是文档里的 authored 值。
    const nextText = current.text ?? previousText
    // 「为空」优先于「未变化」：点击创建的文字本就是空的，用户没敲字就退出时若按
    // 「未变化」放过，文档里会留下一个看不见也选不中的空文字。
    if (nextText.length === 0) {
      // 空 Hug 文字会塌缩到接近零尺寸，既不可见也很难再在画布上选中，留着只会污染场景树。
      // 删除是普通可撤销事务，Ctrl+Z 可恢复。
      dispatch({
        id: idFactory(),
        type: BUILTIN_COMMAND_TYPES.deleteEntity,
        payload: { entityIds: [current.entityId] },
        meta: {
          label: describeEntityTargets(document, [current.entityId]),
          source: 'stage',
          targetIds: [current.entityId],
        },
      })
      return
    }
    if (nextText === previousText) return
    dispatch({
      id: idFactory(),
      type: BUILTIN_COMMAND_TYPES.setRendererProps,
      payload: {
        entityId: current.entityId,
        props: { ...renderer?.props, [propName]: nextText } as JsonValue,
      },
      meta: {
        label: `Edit ${entity.name}`,
        source: 'stage',
        targetIds: [current.entityId],
      },
    })
  }, [measurementAdapter])

  const isEditing = useCallback(() => sessionRef.current !== null, [])

  return {
    session,
    authoredText: session
      ? entityEditableText(params.document, params.registry, session.entityId)
      : null,
    isEditing,
    isTextEditable,
    contentReflowsWithWidth,
    enterTextEditing,
    changeTextEditing,
    exitTextEditing,
  }
}
