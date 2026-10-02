import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

/*
 * Qt 像素对比的预览一侧：把 `native/qt/fixtures/` 下每份夹具文档交给 `?qt-reference` 渲染，
 * 截图写到 `native/qt/out/reference/`，由 `scripts/qt/compare-render.ts` 与 Qt 一侧的截图比较。
 *
 * 字体由用例经路由提供而不依赖系统字体：Qt 一侧加载的是同一个字体文件，两边若各用各的系统
 * 字体，第一张文字截图就对不上，而那与转换毫无关系。
 */

const FIXTURES_DIR = fileURLToPath(new URL('../native/qt/fixtures/', import.meta.url))
const OUTPUT_DIR = fileURLToPath(new URL('../native/qt/out/reference/', import.meta.url))
const FONT_URL = '/__qt-fixtures/fonts/DejaVuSans.ttf'

const fixtureNames = readdirSync(FIXTURES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== 'fonts')
  .map((entry) => entry.name)
  .sort()

test.describe('Qt 对照夹具的预览截图', () => {
  for (const name of fixtureNames) {
    test(`夹具 ${name} 在预览中渲染并写出参考截图`, async ({ page }) => {
      const document: unknown = JSON.parse(readFileSync(`${FIXTURES_DIR}${name}/document.json`, 'utf8'))
      await page.route(`**${FONT_URL}`, (route) => route.fulfill({
        body: readFileSync(`${FIXTURES_DIR}fonts/DejaVuSans.ttf`),
        contentType: 'font/ttf',
      }))
      await page.addInitScript(({ fixture, fontUrl }) => {
        window.__COMPOSE_QT_REFERENCE__ = fixture as never
        // 在应用挂载之前登记字体：文字测量发生在首次布局，晚到的字体会多一次重解。
        document.fonts.add(new FontFace('DejaVu Sans', `url(${fontUrl})`))
      }, { fixture: document, fontUrl: FONT_URL })

      await page.goto('/?qt-reference')
      const frame = page.getByTestId('qt-reference-frame')
      await expect(frame).toBeVisible()
      await page.evaluate(async () => {
        await document.fonts.load('16px "DejaVu Sans"')
        await document.fonts.ready
      })
      // 预览渲染失败时会出现状态提示；夹具文档非法应当在这里而不是在像素对比里暴露。
      await expect(frame.getByRole('status')).toHaveCount(0)
      await frame.screenshot({ path: `${OUTPUT_DIR}${name}.png`, animations: 'disabled' })
    })
  }
})
