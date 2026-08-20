import { describe, expect, it } from 'vitest'
import type { ComposeEntity, JsonObject } from './document-types'
import { documentFixture, rendererEntity } from './test-fixtures'
import { validateComposeDocument } from './document'
import {
  collectComposeInteractionValidationIssues,
  createComposeNavigateInteraction,
  getComposeInteraction,
  isValidComposeInteraction,
  resolveComposeInteractionAction,
} from './interaction'
import type { ComposePageReference } from './page/page-types'

const TARGET: ComposePageReference = {
  kind: 'page',
  providerId: 'demo',
  assetKey: 'pages/detail.page.json',
  scope: 'persistent',
}

function withInteraction(id: string, interaction: JsonObject): ComposeEntity {
  const base = rendererEntity(id)
  return { ...base, components: { ...base.components, Interaction: interaction } }
}

function issuesOf(interaction: JsonObject) {
  const result = validateComposeDocument(
    documentFixture({ [`node`]: withInteraction('node', interaction) }),
  )
  return result.valid ? [] : result.issues
}

describe('Interaction 校验', () => {
  it('OpenSpec: 可选 Interaction Component / 任意 Entity 携带 Interaction', () => {
    const result = validateComposeDocument(
      documentFixture({ node: withInteraction('node', createComposeNavigateInteraction(TARGET)) }),
    )
    expect(result.valid).toBe(true)
  })

  it('OpenSpec: 可选 Interaction Component / 空 triggers 合法', () => {
    expect(issuesOf({ version: 1, triggers: [] })).toEqual([])
    expect(isValidComposeInteraction({ version: 1, triggers: [] })).toBe(true)
  })

  it('OpenSpec: 可选 Interaction Component / 拒绝未知 trigger 与 action', () => {
    const unknownEvent = issuesOf({
      version: 1,
      triggers: [{ event: 'hover', action: { type: 'navigate', target: TARGET } }],
    })
    expect(unknownEvent.map((issue) => issue.code)).toContain('interaction.invalid')
    expect(unknownEvent.some((issue) => issue.message.includes('hover'))).toBe(true)

    const unknownAction = issuesOf({
      version: 1,
      triggers: [{ event: 'click', action: { type: 'open-url', href: 'https://example.com' } }],
    })
    expect(unknownAction.some((issue) => issue.message.includes('open-url'))).toBe(true)
  })

  it('OpenSpec: 可选 Interaction Component / 同一事件不重复声明', () => {
    const issues = issuesOf({
      version: 1,
      triggers: [
        { event: 'click', action: { type: 'navigate', target: TARGET } },
        { event: 'click', action: { type: 'navigate-back' } },
      ],
    })
    expect(issues.some((issue) => issue.message.includes('重复'))).toBe(true)
  })

  it('拒绝 version、未知字段与不完整目标', () => {
    expect(collectComposeInteractionValidationIssues({ version: 2, triggers: [] }))
      .toContainEqual({ path: ['version'], message: 'version 必须是 1' })
    expect(collectComposeInteractionValidationIssues({ version: 1, triggers: [], extra: 1 }))
      .toContainEqual({ path: ['extra'], message: '未知字段 extra' })
    // 目标缺 scope：页面引用不完整时必须被判定为非法，而不是当成"暂时没配"。
    const partial = collectComposeInteractionValidationIssues({
      version: 1,
      triggers: [{ event: 'click', action: { type: 'navigate', target: { kind: 'page', providerId: 'demo', assetKey: 'a' } } }],
    })
    expect(partial).toContainEqual({
      path: ['triggers', 0, 'action', 'target'],
      message: 'target 必须是完整页面引用或 null',
    })
    expect(collectComposeInteractionValidationIssues({ version: 1, triggers: {} }))
      .toContainEqual({ path: ['triggers'], message: 'triggers 必须是数组' })
  })

  it('目标未选择时合法，运行期是 no-op', () => {
    expect(collectComposeInteractionValidationIssues({
      version: 1,
      triggers: [{ event: 'click', action: { type: 'navigate', target: null } }],
    })).toEqual([])
  })

  it('navigate-back 不接受额外字段', () => {
    expect(collectComposeInteractionValidationIssues({
      version: 1,
      triggers: [{ event: 'click', action: { type: 'navigate-back', target: TARGET } }],
    })).toContainEqual({
      path: ['triggers', 0, 'action', 'target'],
      message: '未知字段 target',
    })
  })
})

describe('Interaction 读取', () => {
  it('按事件解析动作', () => {
    const entity = withInteraction('node', createComposeNavigateInteraction(TARGET))
    expect(getComposeInteraction(entity)?.triggers).toHaveLength(1)
    expect(resolveComposeInteractionAction(entity, 'click')).toEqual({
      type: 'navigate',
      target: TARGET,
    })
  })

  it('没有 Interaction 时返回空', () => {
    const entity = rendererEntity('plain')
    expect(getComposeInteraction(entity)).toBeUndefined()
    expect(resolveComposeInteractionAction(entity, 'click')).toBeNull()
    expect(resolveComposeInteractionAction(undefined, 'click')).toBeNull()
  })
})
