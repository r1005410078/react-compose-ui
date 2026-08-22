import { describe, expect, it } from 'vitest'
import { applyComposeAnimationAtTime, COMPOSE_ANIMATION_COMPONENT_KEY } from '@compose-ui/animation'
import { createDocumentTransactionRuntime } from '@compose-ui/core'
import type { ComposeEntity, DocumentValidationIssueShape } from '@compose-ui/core'
import { createCadCommandHandlers } from '../command/cad-command-handlers'
import {
  createCadLineEntity,
  createEmptyCadDocument,
  findCadAnimation,
  getCadAnimations,
  getCadStroke,
  validateCadDocument,
  type CadDocument,
} from './index'

/** 一条带 dashOffset 轨道的线。 */
function animatedDocument(): CadDocument {
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
        components: {
          ...line.components,
          CadStroke: { dashPattern: [8, 6], dashOffset: 0 },
          [COMPOSE_ANIMATION_COMPONENT_KEY]: {
            clips: {
              flow: [{
                path: ['CadStroke', 'dashOffset'],
                valueKind: 'number',
                keyframes: [
                  { id: 'k0', timeMs: 0, value: 0, interpolation: { kind: 'linear' } },
                  { id: 'k1', timeMs: 1000, value: -14, interpolation: { kind: 'linear' } },
                ],
              }],
            },
          },
        },
      },
    },
    animations: [{ id: 'flow', name: '流动', durationMs: 1000, playbackMode: 'loop' }],
  }
}

describe('OpenSpec: cad-document / CAD 动画清单落在文档级', () => {
  it('既有文档读作空清单', () => {
    const withoutAnimations: Record<string, unknown> = { ...createEmptyCadDocument() }
    delete withoutAnimations.animations
    const result = validateCadDocument(withoutAnimations)
    expect(result.valid).toBe(true)
    if (result.valid) expect(getCadAnimations(result.document)).toEqual([])
  })

  it('清单在文档顶层，不挂在任何实体上', () => {
    const document = animatedDocument()
    expect(getCadAnimations(document)).toHaveLength(1)
    expect(findCadAnimation(document, 'flow')?.playbackMode).toBe('loop')
    expect(findCadAnimation(document, 'missing')).toBeNull()
    expect(validateCadDocument(document).valid).toBe(true)
  })

  it('非法清单被拒绝', () => {
    const invalid = [
      [{ id: '', name: 'a', durationMs: 1, playbackMode: 'loop' }],
      [{ id: 'a', name: 'a', durationMs: 0, playbackMode: 'loop' }],
      [{ id: 'a', name: 'a', durationMs: 1, playbackMode: 'nope' }],
    ]
    for (const animations of invalid) {
      const result = validateCadDocument({ ...createEmptyCadDocument(), animations })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.issues[0]?.code).toBe('animation.invalid')
    }

    const duplicated = validateCadDocument({
      ...createEmptyCadDocument(),
      animations: [
        { id: 'a', name: 'a', durationMs: 1, playbackMode: 'loop' },
        { id: 'a', name: 'b', durationMs: 1, playbackMode: 'loop' },
      ],
    })
    expect(duplicated.valid).toBe(false)
    if (!duplicated.valid) {
      expect(duplicated.issues.map(({ code }) => code)).toContain('animation.duplicate-id')
    }
  })

  it('轨道指向不存在的 Component 不算校验失败', () => {
    // 「先建动画、后改线型」是完全合理的顺序；采样本就静默跳过这种轨道。
    const document = animatedDocument()
    const line = document.entities.l1!
    const components = { ...line.components }
    delete (components as Record<string, unknown>).CadStroke
    expect(validateCadDocument({
      ...document,
      entities: { l1: { ...line, components } },
    }).valid).toBe(true)
  })

  it('轨道随 Entity 一起消失', () => {
    const store = createDocumentTransactionRuntime<CadDocument, DocumentValidationIssueShape>({
      document: animatedDocument(),
      validate: validateCadDocument,
      handlers: createCadCommandHandlers(),
    })
    expect(store.dispatch({
      id: 'c1',
      type: 'cad.entity.remove',
      payload: { entityId: 'l1' } as never,
    }).status).toBe('committed')
    // 轨道住在 Entity 上，因此不需要任何清理清单的补偿代码。
    expect(store.document.entities.l1).toBeUndefined()
    expect(getCadAnimations(store.document)).toHaveLength(1)
  })
})

describe('OpenSpec: cad-document / CAD 复用同一份动画采样', () => {
  it('CAD 文档采样出插值结果', () => {
    const sampled = applyComposeAnimationAtTime(animatedDocument(), 'flow', 500)
    expect(getCadStroke(sampled.entities.l1!)?.dashOffset).toBeCloseTo(-7)
  })

  it('两种文档形状得到同样的插值结果', () => {
    // 同一形状的轨道挂在一个最小的「带 entities 的文档」上——泛型放宽之后它同样能被采样。
    const entity: ComposeEntity = animatedDocument().entities.l1!
    const pageLike = { entities: { l1: entity }, rootIds: ['l1'] }
    const sampled = applyComposeAnimationAtTime(pageLike, 'flow', 500)
    expect((sampled.entities.l1!.components.CadStroke as { dashOffset: number }).dashOffset)
      .toBeCloseTo(-7)
  })

  it('未命中的对象保持原引用', () => {
    const document = animatedDocument()
    const plain = createCadLineEntity('l2', {
      layerId: '0',
      start: { x: 0, y: 50 },
      end: { x: 10, y: 50 },
    })
    const withPlain: CadDocument = {
      ...document,
      rootIds: ['l1', 'l2'],
      entities: { ...document.entities, l2: plain },
    }
    const sampled = applyComposeAnimationAtTime(withPlain, 'flow', 500)
    expect(sampled.entities.l2).toBe(plain)
  })

  it('动画不存在时原样返回', () => {
    const document = animatedDocument()
    expect(applyComposeAnimationAtTime(document, 'missing', 500)).toBe(document)
  })
})
