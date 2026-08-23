# Tasks

## 1. 依赖与边界

- [ ] 1.1 `packages/materials/package.json` 新增 `@compose-ui/animation": "workspace:*"`；`bun install`
- [ ] 1.2 `AGENTS.md` 的 materials 允许依赖清单加上 `animation`，并写明限定语
      「`animation` 只用于组件实例的嵌套文档采样」，与 `layout-engine` 那句并列
- [ ] 1.3 `bun run build` 确认没有循环依赖

## 2. 采样（先验红）

- [ ] 2.1 在 `packages/materials/src/component-instance/component-instance.test.tsx` 写红：
      同一份快照、`animationTime` 取 0 与轨道终点两次渲染，断言嵌套 Entity 的呈现值不同。
      **先跑，确认红**——当前实现里没有任何采样代码，值恒为作者值
- [ ] 2.2 再写第二条红：**两个**实例、同一份快照、两个不同的 `animationTime`，断言同一帧内
      两者呈现不同姿态。这条才是判别性的——播放头写成全局单值的实现能过 2.1，过不了 2.2
- [ ] 2.3 `renderer.tsx`：在 `resolveComposeInstanceOverrides` 之后、
      `ResolvedComponentContent` 之前采样。`useMemo` 依赖 `[document, animationId, timeMs]`
- [ ] 2.4 读 `animation` / `animationTime`：类型不符按缺席处理（与既有 props 读取一致）
- [ ] 2.5 钳制到 `[0, durationMs]`，时长取自 `getComposeAnimations(document, rootId)`
- [ ] 2.6 `animation` 为 `null` 或 id 不在清单里时不调用采样器，直接返回原文档引用
- [ ] 2.7 2.1、2.2 转绿

## 3. 引用相等与无采样路径

- [ ] 3.1 用例：`animation` 缺席时，两次渲染之间 `layoutDocument` 引用不变（不触发多余重解）
- [ ] 3.2 用例：所选动画在该文档里没有任何轨道时，采样器返回原引用，同样不触发重解

## 4. Prop Contracts 与 Inspector

- [ ] 4.1 `definition.tsx` 加 `propContracts`：`animation`（value，允许 `string | null`）与
      `animationTime`（value，有限数值）；`propCategories` 加一组「动画」
- [ ] 4.2 `inspectorPropNames` 列出这两条
- [ ] 4.3 新建 `animation-inspector.tsx`：下拉用 `resolvedSnapshot` 的根 Frame 清单构建；
      当前值不在清单里时把它作为一个标注为失效的额外条目留在下拉里，**不清空**
- [ ] 4.4 用例：失效 id 与「未选择」在 Inspector 上呈现不同（断言可访问名称，不断言类名）
- [ ] 4.5 更新 `renderer-prop-contracts.test.ts`：component-instance 的契约名单

## 5. 绑定纵向（e2e）

- [ ] 5.1 `e2e/instance-animation.spec.ts`：矩形 → 建旋转动画 → 存成组件 →
      页面上放**两个**实例 → 页面 setup 脚本导出两个数 → 各自绑 `animationTime` →
      断言两个实例的旋转不同
- [ ] 5.2 断言用实际渲染出来的变换矩阵，不用属性——组件实例的姿态经过嵌套 Yoga，
      属性上读到的是作者值
- [ ] 5.3 顺带断言组件源文档未被修改（实例覆盖里没有 `Animations` 相关条目）

## 6. 收口

- [ ] 6.1 `bun run lint`
- [ ] 6.2 `bun run typecheck`
- [ ] 6.3 `bun run test`
- [ ] 6.4 `bun run build`
- [ ] 6.5 `bun run test:e2e`
- [ ] 6.6 `bunx openspec validate add-instance-animation --strict`
- [ ] 6.7 路线图步骤 5 标记已交付，并把「要在提案里定的是粒度」那段改成结论：
      绑定住在宿主侧，粒度问题不存在
