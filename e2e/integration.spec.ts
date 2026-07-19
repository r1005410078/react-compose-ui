import { expect, test } from '@playwright/test'

test('mounts the editor and preview workspace packages', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'React Compose UI' }),
  ).toBeVisible()
  await expect(page.getByRole('region', { name: 'Compose editor' })).toHaveAttribute(
    'data-compose-core',
    '@compose-ui/core',
  )
  await expect(page.getByRole('region', { name: 'Compose preview' })).toHaveAttribute(
    'data-compose-core',
    '@compose-ui/core',
  )
})
