import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ComposePreview } from './index'

describe('ComposePreview', () => {
  it('mounts an identifiable preview region', () => {
    render(<ComposePreview />)

    expect(screen.getByRole('region', { name: 'Compose preview' })).toHaveAttribute(
      'data-compose-ui',
      'preview',
    )
  })
})
