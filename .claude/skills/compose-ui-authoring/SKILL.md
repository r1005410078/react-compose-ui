---
name: compose-ui-authoring
description: 用浏览器驱动 React Compose UI 编辑器，把一张设计稿在场景里搭出来（容器/文字/图表/Auto Layout/Grid/配色/预览），并记录遇到的编辑器缺陷。当需要「还原效果图」「在编辑器里搭大屏」「跑通编辑器的真实操作流程」「dogfood 编辑器」时使用。
---

# 用浏览器还原一张设计稿

把一张设计稿在 `app/` 示例编辑器里真实搭出来。用于验收编辑器的可用性，
**每踩一个坑都要记下来**——产出是「还原结果 + 问题清单」两份。

## 先决条件

```bash
bun run build
bun run --cwd app preview --host 127.0.0.1 --port 4173   # 后台跑
```

Playwright 用仓库里已有的那份（bun 是隔离安装，`playwright` 这个包名解析不到）：

```js
// pw.mjs
import { createRequire } from 'node:module'
const require = createRequire('<repo>/package.json')
export const { chromium } = require('<repo>/node_modules/.bun/playwright-core@<ver>/node_modules/playwright-core/index.js')
```

**用有头浏览器**（`chromium.launch({ headless: false, slowMo: 6 })`）：这是给人看的验收，
不是回归用例。视口取 `2600×1500`，1920×1080 的场景在 88% 缩放下整块可见，落点不用翻页。

## 坐标映射

世界坐标 → 屏幕坐标一律从 frame 的实时盒子换算，别假设缩放：

```js
const box = await page.getByTestId('stage-frame-frame-root').boundingBox()
const w2s = (wx, wy) => ({ x: box.x + wx / 1920 * box.width, y: box.y + wy / 1080 * box.height })
```

## 基本操作

| 事情 | 做法 |
|---|---|
| 改场景尺寸 | 双击 `stage-scene-size-frame-root` → 选预设 → 「确定」 |
| 建容器/图表 | 从物料面板按钮（`添加 容器` / `添加 图表`）拖到画布，**落点决定父级** |
| 建文字 | 工具栏「文字」→ 画布点一下 → `keyboard.insertText` → `Escape` |
| 改几何 | 属性面板 `位置 X` / `位置 Y` / `尺寸宽度` / `尺寸高度`（注意 `位置 X` 中间有空格） |
| 改颜色 | 见下方「颜色」 |
| 选中深层节点 | 场景树搜索框 `搜索节点` 输入名称 → 点结果行 → 清空搜索 |

给每个要配布局的容器**起唯一名字**，否则后面按名字选不中。

## 颜色

```js
await swatch.click()                                   // xpath: 行标签后面第一个 semantic-editor-*
const hex = page.locator('[aria-label="HEX"]:visible').first()
await hex.fill('0D1B3A')                               // `#` 可以省
await hex.press('Enter')                               // Enter 与 blur 都提交
await page.keyboard.press('Escape')
```

两种弹框形态（`背景填充` 走 Paint Picker 内嵌、`边框颜色/文字颜色` 走带 Trigger 的形态）
现在**共用同一块值行**，打开即有一个 HEX 框，不用再去展开什么。非法值当场退回当前值，
所以**填完读一遍回显**即可确认是否收下。

## 文字

Hug（不填宽高）现在是安全的，中文也一样——测量与渲染钉同一个排版 locale。想**断定**
某条文字没有折行，数它的**行盒数量**而不是比宽度（字宽随机器上装了哪些字体变）：

```js
const lines = await node.evaluate((el) => {
  const range = document.createRange()
  range.selectNodeContents(el.querySelector('.compose-material--text-content'))
  return range.getClientRects().length
})
```

**「行高」默认是「未设置」**，也就是浏览器的 `normal`。要一个确定的行高得先点开这一行的
存在性开关（`[aria-label="行高 存在"]`，用 `click()` 不要用 `check()`——打开之后这个开关
会收进「更多」聚合菜单，`check()` 的回读找不到它），再写值。

## Auto Layout / Grid（有坑）

**顺序：先把子项按绝对坐标建好，最后再给父容器加布局。**
反过来（先加布局再从画布拖子项）做不出第二个同级子项：落点取指针下**最深**的容器，
而第一个子项盖住了父容器中心，之后每一次拖放都落进上一个子项（问题清单 L-2）。
非要先加布局，就走场景树的「新增节点」按钮。

**布局要一层层应用，深的先应用**（post-order）。父容器的布局先跑会把子项的临时几何打乱，
之后子容器再应用布局就是在错的基础上排——症状是「大部分对，个别卡片整块塌掉」。

加布局：

```js
await page.locator('[aria-label="添加布局"]').first().click()
await page.getByText('Auto Layout', { exact: true }).click()   // 或「网格」
await page.locator('[data-flex-layout-field="flex-direction"]').first().waitFor()
```

字段当场就在（此前需要「切走再切回」，那是问题清单 L-1，已修）。

控件钩子：

- 方向 `[data-flex-layout-field="flex-direction"] button[aria-label="横向|纵向|反向横向|反向纵向"]`
- 换行 `flex-wrap`：`不换行|换行|反向换行`
- 主轴 `justify-content`：`起始|居中|末端|两端|环绕|均匀`
- 交叉轴 `align-items`：`起始|居中|末端|拉伸|基线`
- `项间距` / `内边距` 是普通输入
- Grid 父：`列数` / `行高` / `项间距` / `内边距` / `空洞自动填上`
- Grid 子：`网格尺寸 宽` / `网格尺寸 高` / `网格位置 列` / `网格位置 行`。
  **必须按这个顺序写**：位置会被钳制到「跨度放得下」的范围里，先写位置后写尺寸时那个
  钳制按**旧**跨度算，写 `列=6` 读回 `5`。先尺寸后位置即可，且钳制是静默的——写完读一遍回显。
  子项的 `尺寸宽度/高度` 会被禁用，尺寸由网格决定

若容器已有 Auto Layout 还要加子项，走场景树的「新增节点」按钮，**不要**从画布拖。

交叉轴默认是 `flex-start`：子项保持自己写下的高度，父级不再改写子级的 `LayoutItem`。
要子项填满交叉轴，把它的 `尺寸高度` 显式设成 `Fill`（或把父级交叉轴设成「拉伸」并让
子项的交叉轴是 Hug）。

## 把画布本身做成网格

场景（Frame）也接受布局，因此整张大屏可以建在一个 12 列画布网格上：

```
列宽 147、行高 36、间距 12、内边距 12
12*147 + 11*12 + 2*12 = 1920     22 行 = 22*36 + 21*12 + 2*12 = 1068 ≤ 1080
colX(c) = 12 + c*159   colW(n) = 159n - 12
rowY(r) = 12 + r*48    rowH(n) = 48n - 12
```

两条必须知道的：

1. **启用网格用的是默认参数**（12 列 / 行高 48 / 间距 6 / 内边距 16），落位按**那一份**
   从像素推出来。因此把参数改成自己的几何之后，落位与像素位置对不上。改完参数走
   「更多网格操作 › 按当前几何重新落位」重推一次即可（问题清单 G-2）；或者干脆显式写一遍
   每个块的落位，两条路都稳定收敛。
2. **「空洞自动填上」默认开着**，写进去的行号会被上浮压缩（写 row 1 读回 row 0）。这是
   GridStack 式的设计行为，需要保留行号就先关掉这个开关——它与上一条叠在一起时，很难判断
   看到的错位来自哪一个。

## 结构建议

大屏这类页面分两层用：

- **卡片摆位**用绝对坐标（画布本来就是绝对坐标系）
- **卡片内部**的重复结构（表格行、KPI 行、图例列表、指标格）用 Auto Layout；
  2×2 这种规则网格用 Grid

## 验收

建完点工具栏「打开预览」，对着设计稿比一遍；截图存档。

## 记录问题

边做边记，每条写清：**怎么复现 / 看到什么 / 期望什么 / 证据**。
判据是「一个实施工程师照着设计稿做，会不会被这一条挡住或做出错的东西」。
