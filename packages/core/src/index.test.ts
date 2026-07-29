import { describe, expect, it } from 'vitest'
import * as core from './index'

describe('@compose-ui/core public API', () => {
  it('只公开 v4 ECS 文档入口', () => {
    expect(core.COMPOSE_UI_CORE_PACKAGE).toBe('@compose-ui/core')
    expect(core.COMPOSE_BUILTIN_COMPONENT_KEYS.transform).toBe('Transform')
    expect(core).toHaveProperty('validateComposeDocument')
    expect(core).toHaveProperty('getComposeTransform')
    expect(core).not.toHaveProperty('resolveNodeStyle')
  })
})
