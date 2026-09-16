## 1. 新包骨架

- [x] 1.1 `packages/chart-materials/`：package.json、tsconfig、vite、vitest、README
- [x] 1.2 echarts 依赖与按需注册（line/bar/pie + grid/title/tooltip/legend + canvas renderer）
- [x] 1.3 `AGENTS.md` 补上这个包的架构边界

## 2. 物料

- [x] 2.1 Props Schema：`kind` / `title` / `categories` / `series` / `palette` / `textColor` /
      `axisColor` / `showLegend`
- [x] 2.2 Renderer：按 `kind` 分派 `series.type`，饼图取第一条系列
- [x] 2.3 `ResizeObserver` 跟随自身盒子；卸载时 dispose
- [x] 2.4 三个 Preset（折线图 / 柱状图 / 饼图）指向同一个 Renderer
- [x] 2.5 Inspector 与绑定契约（每个 prop 都有 `valueContract`，绑定入口因此也给全——
      只给其中几个会让「哪些能绑」变成契约上读不出来的暗知识）
- [x] 2.6 `createComposeChartMaterials()` 公共入口

## 3. 示例应用

- [x] 3.1 注册第一方图表物料，删掉演示用的 `echarts-bar` Renderer 与 Preset
- [x] 3.2 更新引用了 `echarts-bar` 的既有用例（materials / editor-workspace 两处，
      含物料面板格数 6 → 8）

## 4. 用例

- [x] 4.1 单测：三种 kind 产出对应的 echarts series 类型
- [x] 4.2 单测：饼图取第一条系列、类目作扇区名
- [x] 4.3 单测：改 kind 不丢类目与系列
- [x] 4.4 组件测试：盒子尺寸变化触发重绘（`ResizeObserver` 而不是 `window.resize`）
- [x] 4.5 e2e：三格物料各拖一个，都画出 `<canvas>`

## 5. 门禁

- [x] 5.1 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
