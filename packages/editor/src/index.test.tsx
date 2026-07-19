import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ComposeEditor } from './index'

describe('ComposeEditor', () => {
  it('mounts an identifiable editor region', () => {
    render(<ComposeEditor />)

    expect(screen.getByRole('region', { name: 'Compose editor' })).toHaveAttribute(
      'data-compose-ui',
      'editor',
    )
  })
})
