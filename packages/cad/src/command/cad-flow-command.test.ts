import { describe, expect, it } from 'vitest'
import { COMPOSE_ANIMATION_COMPONENT_KEY } from '@compose-ui/animation'
import { createDocumentTransactionRuntime } from '@compose-ui/core'
import type { DocumentValidationIssueShape } from '@compose-ui/core'
import {
  createCadLineEntity,
  createEmptyCadDocument,
  getCadAnimations,
  getCadStroke,
  validateCadDocument,
  type CadDocument,
} from '../document'
import { createCadTestCommandContext as context } from '../test-fixtures'
import {
  CAD_FLOW_DEFAULT_DASH,
  CAD_FLOW_DURATION_MS,
  createCadCommandHandlers,
} from './cad-command-handlers'
import { createCadFlowSession } from './cad-flow-command'

function documentWith(stroke?: Record<string, unknown>): CadDocument {
  const base = createEmptyCadDocument()
  const line = createCadLineEntity('l1', {
    layerId: '0',
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
  })
  return {
    ...base,
    rootIds: ['l1'],
    entities: {
      l1: {
        ...line,
        components: stroke
          ? { ...line.components, CadStroke: stroke as never }
          : line.components,
      },
    },
  }
}

function runtime(document: CadDocument) {
  return createDocumentTransactionRuntime<CadDocument, DocumentValidationIssueShape>({
    document,
    validate: validateCadDocument,
    handlers: createCadCommandHandlers(),
  })
}

function commitFlow(document: CadDocument) {
  const session = createCadFlowSession(context(['l1']))
  // 已经选好对象：没有要等的输入，宿主立刻以 accept 推进。
  const step = session.advance({ kind: 'accept' })
  if (step.status !== 'commit' || !step.effect.command) throw new Error('应当提交')
  const store = runtime(document)
  expect(store.dispatch(step.effect.command).status).toBe('committed')
  return store
}

function trackOf(store: ReturnType<typeof runtime>) {
  const clips = (store.document.entities.l1!.components[COMPOSE_ANIMATION_COMPONENT_KEY] as {
    clips: Record<string, readonly { keyframes: readonly { value: number }[] }[]>
  }).clips
  const animationId = getCadAnimations(store.document)[0]!.id
  return clips[animationId]![0]!
}

describe('OpenSpec: cad-document / CAD 虚线偏移与 FLOW 命令', () => {
  it('一条命令得到一根流动的线', () => {
    const store = commitFlow(documentWith())
    // 实线上的偏移动画在屏幕上没有任何变化，因此命令补上默认线型。
    expect(getCadStroke(store.document.entities.l1!)?.dashPattern).toEqual(CAD_FLOW_DEFAULT_DASH)
    const animation = getCadAnimations(store.document)[0]!
    expect(animation).toMatchObject({ durationMs: CAD_FLOW_DURATION_MS, playbackMode: 'loop' })

    store.undo()
    expect(getCadAnimations(store.document)).toEqual([])
    expect(getCadStroke(store.document.entities.l1!)).toBeUndefined()
  })

  it('轨道走满一个完整虚线周期', () => {
    const store = commitFlow(documentWith())
    const period = CAD_FLOW_DEFAULT_DASH.reduce((sum, value) => sum + value, 0)
    const keyframes = trackOf(store).keyframes
    expect(keyframes[0]!.value).toBe(0)
    // 走满一个周期，循环接缝处的图案与起点逐像素相同；半个周期会让每次循环闪一下。
    expect(keyframes[1]!.value).toBe(-period)
  })

  it('偏移朝负方向，图案顺着线走', () => {
    expect(trackOf(commitFlow(documentWith())).keyframes[1]!.value).toBeLessThan(0)
  })

  it('已有线型的图元保留自己的线型，周期按它自己的算', () => {
    const store = commitFlow(documentWith({ dashPattern: [20, 5] }))
    expect(getCadStroke(store.document.entities.l1!)?.dashPattern).toEqual([20, 5])
    expect(trackOf(store).keyframes[1]!.value).toBe(-25)
  })

  it('产出的文档通过校验', () => {
    expect(validateCadDocument(commitFlow(documentWith()).document).valid).toBe(true)
  })

  it('没有选择时先提示选择对象', () => {
    const session = createCadFlowSession(context())
    expect(session.prompt?.accepts).toEqual(['selection'])
    session.advance({ kind: 'selection', ids: ['l1'] })
    expect(session.advance({ kind: 'accept' }).status).toBe('commit')
  })

  it('没选任何东西就结束不写入', () => {
    const session = createCadFlowSession(context())
    expect(session.advance({ kind: 'accept' }).status).toBe('cancelled')
  })
})
