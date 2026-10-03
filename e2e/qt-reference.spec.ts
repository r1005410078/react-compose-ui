import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

/*
 * Qt 像素对比的预览一侧：把 `native/qt/fixtures/` 下每份夹具文档交给 `?qt-reference` 渲染，
 * 截图写到 `native/qt/out/reference/`；同一页对同一份场景的导出产物写到
 * `native/qt/out/export/<夹具>/`（`Scene.qml`，有脚本时还有 setup 与 `ComposeRuntime/`）。
 * Qt 一侧截的是导出结果，`scripts/qt/compare-render.ts` 比较两边。
 *
 * 脚本夹具多三个文件：`setup.js`（页面脚本）、`expected.json`（脚本跑完之后各对象 Renderer prop
 * 的期望值）与可选的 `data.json`（脚本 fetch 的数据，随产物放在场景旁边）。预览不跑脚本，参考图
 * 画的是写进期望值的文档；Qt 跑真脚本——两边一致即说明脚本在 Qt 里跑出了期望的画面。
 *
 * 字体由用例经路由提供而不依赖系统字体：Qt 一侧加载的是同一个字体文件，两边若各用各的系统
 * 字体，第一张文字截图就对不上，而那与转换毫无关系。
 */

const FIXTURES_DIR = fileURLToPath(new URL('../native/qt/fixtures/', import.meta.url))
const OUTPUT_DIR = fileURLToPath(new URL('../native/qt/out/reference/', import.meta.url))
const EXPORT_DIR = fileURLToPath(new URL('../native/qt/out/export/', import.meta.url))
const FONT_ROUTE = '/__qt-fixtures/fonts/'
/** 夹具字体与字重。粗体必须有自己的文件：缺了它两边会各自合成粗体，合成方式并不相同。 */
const FONTS = [
  { file: 'DejaVuSans.ttf', weight: '400' },
  { file: 'DejaVuSans-Bold.ttf', weight: '700' },
] as const

const fixtureNames = readdirSync(FIXTURES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== 'fonts')
  .map((entry) => entry.name)
  .sort()

/*
 * Linux 上的无头 Chromium 缺省把字形落在整像素上（字宽取整），一行文字累积出两三个像素；Qt 在
 * Linux 与 macOS 上都按亚像素排字，与 macOS 的 Chromium 一致。偏的是参考图这一侧，因此在这里关掉
 * hinting，而不是去改导出。该开关只在 Linux 无头模式生效，macOS 上无副作用。
 */
test.use({ launchOptions: { args: ['--font-render-hinting=none'] } })

test.describe('Qt 对照夹具的预览截图', () => {
  for (const name of fixtureNames) {
    test(`夹具 ${name} 在预览中渲染并写出参考截图`, async ({ page }) => {
      const fixtureDir = `${FIXTURES_DIR}${name}/`
      const document: unknown = JSON.parse(readFileSync(`${fixtureDir}document.json`, 'utf8'))
      const setup = existsSync(`${fixtureDir}setup.js`) ? readFileSync(`${fixtureDir}setup.js`, 'utf8') : undefined
      const expected: unknown = existsSync(`${fixtureDir}expected.json`)
        ? JSON.parse(readFileSync(`${fixtureDir}expected.json`, 'utf8'))
        : undefined
      await page.route(`**${FONT_ROUTE}*`, (route) => route.fulfill({
        body: readFileSync(`${FIXTURES_DIR}fonts/${new URL(route.request().url()).pathname.split('/').pop()}`),
        contentType: 'font/ttf',
      }))
      await page.addInitScript(({ fixture, fonts, route, setup, expected }) => {
        window.__COMPOSE_QT_REFERENCE__ = fixture as never
        if (setup !== undefined) window.__COMPOSE_QT_SETUP__ = setup
        if (expected !== undefined) window.__COMPOSE_QT_EXPECTED__ = expected as never
        // 在应用挂载之前登记字体：文字测量发生在首次布局，晚到的字体会多一次重解。
        for (const font of fonts) {
          document.fonts.add(new FontFace('DejaVu Sans', `url(${route}${font.file})`, { weight: font.weight }))
        }
      }, { fixture: document, fonts: FONTS, route: FONT_ROUTE, setup, expected })

      await page.goto('/?qt-reference')
      const frame = page.getByTestId('qt-reference-frame')
      await expect(frame).toBeVisible()
      await page.evaluate(async () => {
        await document.fonts.load('16px "DejaVu Sans"')
        await document.fonts.load('bold 16px "DejaVu Sans"')
        await document.fonts.ready
      })
      // 预览渲染失败时会出现状态提示；夹具文档非法应当在这里而不是在像素对比里暴露。
      await expect(frame.getByRole('status')).toHaveCount(0)
      await frame.screenshot({ path: `${OUTPUT_DIR}${name}.png`, animations: 'disabled' })

      // 导出跟着布局 Runtime 的每次求解刷新，且是异步的（实例求解、脚本编译）；等字体就绪之后
      // 那一次求解的导出落定。
      await page.waitForFunction(() => window.__COMPOSE_QT_EXPORT__ !== undefined && !window.__COMPOSE_QT_EXPORT_PENDING__)
      const exported = await page.evaluate(() => window.__COMPOSE_QT_EXPORT__)
      expect(exported?.qml, '页面没有产出 QML 导出结果').toBeTruthy()
      const target = `${EXPORT_DIR}${name}/`
      rmSync(target, { recursive: true, force: true })
      for (const file of exported!.files) {
        mkdirSync(dirname(`${target}${file.path}`), { recursive: true })
        writeFileSync(`${target}${file.path}`, file.content)
      }
      if (existsSync(`${fixtureDir}data.json`)) copyFileSync(`${fixtureDir}data.json`, `${target}data.json`)
      writeFileSync(`${target}diagnostics.json`, `${JSON.stringify(exported!.diagnostics, null, 2)}\n`)
    })
  }
})
