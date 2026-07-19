import { describe, expect, it } from 'vitest'
import { COMPOSE_UI_CORE_PACKAGE } from './index'

describe('@compose-ui/core', () => {
  it('exposes its package identity without importing React', () => {
    expect(COMPOSE_UI_CORE_PACKAGE).toBe('@compose-ui/core')
  })
})
