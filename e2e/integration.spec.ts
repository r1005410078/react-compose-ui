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

test('adds a text component and updates the preview', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const preview = page.getByRole('region', { name: 'Compose preview' })

  await editor.getByRole('button', { name: '添加文本组件' }).click()

  const textNode = editor
    .getByRole('region', { name: '编辑画布' })
    .getByRole('button', { name: '默认文本' })
  await expect(textNode).toBeVisible()

  await textNode.click()
  await editor.getByLabel('文本内容').fill('客户现场大屏')

  await expect(preview.getByText('客户现场大屏')).toBeVisible()
})
