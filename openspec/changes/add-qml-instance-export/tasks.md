# 任务

## 1. 提取准备管线（先保证预览不回归）

- [x] 1.1 `materials/component-instance/prepare.ts`：纯函数与可判别结果（先写用例）
      - Red：首版只取祖先链长度当深度，既有用例「超过八层时拒绝」失败——深度由
        `ComposeComponentInstanceNestProvider` 单独给出，可以与祖先链长度不同。
      - Green：加可选 `depth`（缺省为祖先链长度），渲染器传 Context 里的深度；`prepare.test.ts` 5 条通过。
- [x] 1.2 `renderer.tsx` 改为调用它；祖先链经参数传入
      - 按准备管线实际读取的各个 prop 记忆结果，无关重渲染不再触发嵌套 Yoga 重解。
- [x] 1.3 回归：materials 组件测试、`instance-animation` / `instance-content-fit` / `component-library` e2e
      - `vitest run src/component-instance` 32 passed；三份 e2e 11 passed。
- [x] 1.4 公开入口与 TSDoc

## 2. 导出器

- [x] 2.1 `instances` 输入与复合地址
- [x] 2.2 实例映射：裁剪、翻转、内容缩放、id 前缀
      - 实例是叶子，外层本来就 `clip: true`，因此不再另套一层裁剪 Item；翻转与缩放分两层 `Scale`
        （原点不同，与预览的两层 transform 一一对应）。
- [x] 2.3 嵌套实例递归；缺失与失败的占位兜底
      - 新诊断码 `instance.unresolved`（与 `renderer.placeholder` 分开：前者是「调用方没给结果」，
        后者是「这种内容不支持」）；诊断的 `entityId` 写复合地址。`qml-export` 36 passed。

## 3. 编辑器

- [x] 3.1 逐实例准备与求解（递归），异步导出与进行中提示
      - 求解住 `materials/component-instance/solve.ts`，编辑器经 `qmlInstances` 注入（编辑器不依赖
        `materials`）；`solve.test.ts` 覆盖嵌套地址与跳过隐藏实例。
      - 去重未做：PERF 注释写明「按组件引用 + 覆盖 + 盒尺寸去重」为后续优化。
- [x] 3.2 组件测试与 e2e：导出含实例的场景
      - `export-active-scene.test.ts` 断言以激活场景为起点调用注入的求解；`e2e/qml-export.spec.ts`
        新增「导出含实例的场景」：复合地址 objectName 与实例内的 Shape（不注入求解时两条都不成立）。

## 4. 验收

- [x] 4.1 实例夹具（覆盖、`contentFit: scale`、翻转、嵌套一层），`?qt-reference` 走同一条求解路径
      - `native/qt/fixtures/instances`：同组件两个实例（其一覆盖色块颜色）、`scale` + `flip: x`、
        组件内嵌实例。人工核对两侧截图：覆盖、镜像、缩放、嵌套均出现。
- [x] 4.2 像素对比通过
      - 本机（macOS offscreen）与 Linux CI 上 `instances` 差异像素都是 0。

## 5. 文档与验证

- [x] 5.1 `AGENTS.md`：准备管线的归属与「预览与导出共用」的判据
- [x] 5.2 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
      - 全部通过；`test:e2e` 392 passed。
- [x] 5.3 `npx openspec validate add-qml-instance-export --strict`
