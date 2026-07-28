import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ComposeThemeProvider } from '@compose-ui/ui-context'
import * as publicApi from '../index'
import { ComposeButton, type ComposeButtonProps } from '../index'

const buttonContractFixture: ComposeButtonProps = {
  'aria-label': 'Delete document',
  className: 'host-button',
  'data-asset-id': 'asset-1',
  id: 'delete-document',
  type: 'button',
  variant: 'destructive',
}

afterEach(cleanup)

describe('ComposeButton', () => {
  it('OpenSpec: components / Shadcn primitives follow Compose theme boundaries / Render a primitive under an overridden Compose theme — stylesheet avoids global Shadcn state', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

    expect(styles).toContain('prefix(cu)')
    expect(styles).not.toContain("@import 'tailwindcss';")
    expect(styles).not.toContain('shadcn/tailwind.css')
    expect(styles).not.toMatch(/(^|\n)\s*:root\b/m)
    expect(styles).not.toMatch(/(^|\n)\s*\.dark\b/m)
  })

  it('OpenSpec: components / Shadcn source-owned shared primitive foundation / Add a shared primitive through the configured workflow — raw Shadcn names remain private', () => {
    expect(publicApi).toHaveProperty('ComposeButton')
    expect(publicApi).not.toHaveProperty('Button')
    expect(publicApi).not.toHaveProperty('buttonVariants')
  })

  it('OpenSpec: components / Shadcn source-owned shared primitive foundation / Add a shared primitive through the configured workflow', () => {
    render(
      <ComposeButton
        {...buttonContractFixture}
      >
        Delete
      </ComposeButton>,
    )

    const button = screen.getByRole('button', { name: 'Delete document' })
    expect(button).toHaveAttribute('id', 'delete-document')
    expect(button).toHaveAttribute('data-asset-id', 'asset-1')
    expect(button).toHaveClass('host-button')
    expect(button).toHaveAttribute('type', 'button')
  })

  it('OpenSpec: components / Shadcn source-owned shared primitive foundation / Add a shared primitive through the configured workflow — disabled semantics', () => {
    render(<ComposeButton disabled>Save</ComposeButton>)

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('OpenSpec: components / Shadcn primitives follow Compose theme boundaries / Render a primitive under an overridden Compose theme', () => {
    render(
      <ComposeThemeProvider
        overrides={{ light: { accent: '#7c3aed' } }}
        theme="light"
      >
        <ComposeButton>Apply</ComposeButton>
      </ComposeThemeProvider>,
    )

    const button = screen.getByRole('button', { name: 'Apply' })
    expect(button).toHaveAttribute('data-compose-theme', 'light')
    expect(button).toHaveStyle({ '--compose-accent': '#7c3aed' })
  })
})
