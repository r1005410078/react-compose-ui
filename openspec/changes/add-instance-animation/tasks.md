# Tasks

## 1. 依赖与边界

- [x] 1.1 `packages/materials/package.json` 新增 `@compose-ui/animation": "workspace:*"`；`bun install`
- [x] 1.2 `AGENTS.md` 的 materials 允许依赖清单加上 `animation`，并写明限定语
      「`animation` 只用于组件实例的嵌套文档采样」，与 `layout-engine` 那句并列
- [x] 1.3 `bun run build` 确认没有循环依赖

## 2. 采样（先验红）

- [x] 2.1 在 `packages/materials/src/component-instance/component-instance.test.tsx` 写红：
      同一份快照、`animationTime` 取 0 与轨道终点两次渲染，断言嵌套 Entity 的呈现值不同。
      **先跑，确认红**——当前实现里没有任何采样代码，值恒为作者值
- [x] 2.2 再写第二条红：**两个**实例、同一份快照、两个不同的 `animationTime`，断言同一帧内
      两者呈现不同姿态。这条才是判别性的——播放头写成全局单值的实现能过 2.1，过不了 2.2
- [x] 2.3 `renderer.tsx`：在 `resolveComposeInstanceOverrides` 之后、
      `ResolvedComponentContent` 之前采样。`useMemo` 依赖 `[document, animationId, timeMs]`
- [x] 2.4 读 `animation` / `animationTime`：类型不符按缺席处理（与既有 props 读取一致）
- [x] 2.5 钳制到 `[0, durationMs]`，时长取自 `getComposeAnimations(document, rootId)`
- [x] 2.6 `animation` 为 `null` 或 id 不在清单里时不调用采样器，直接返回原文档引用
- [x] 2.7 2.1、2.2 转绿

## 3. 引用相等与无采样路径

- [x] 3.1 用例：`animation` 缺席时，两次渲染之间 `layoutDocument` 引用不变（不触发多余重解）
- [x] 3.2 用例：所选动画在该文档里没有任何轨道时，采样器返回原引用，同样不触发重解

## 4. Prop Contracts 与 Inspector

- [x] 4.1 `definition.tsx` 加 `propContracts`：`animation`（value，允许 `string | null`）与
      `animationTime`（value，有限数值）；`propCategories` 加一组「动画」
- [x] 4.2 `inspectorPropNames` 列出这两条
- [x] 4.3 Inspector 用 `resolvedSnapshot` 的根 Frame 清单构建下拉；当前值不在清单里时把它
      作为一个标注为失效的额外条目留在下拉里，**不清空**。
      **落点与提案不同**：提案写的是新建 `component-instance/animation-inspector.tsx`，
      实际放进了 `material-inspector-kit/renderer-inspectors.tsx`——包内既有安排就是
      「schema 住功能目录、Inspector 住 kit」（curve 正是这样），而独立文件需要把
      `dispatchProps` / `createPropsBinding` / `inspectorBaseProps` 三个私有 helper 导出。
- [x] 4.4 用例：失效 id 与「未选择」在 Inspector 上呈现不同（断言可访问名称，不断言类名）
- [x] 4.5 更新 `renderer-prop-contracts.test.ts`：component-instance 的契约名单

## 5. 绑定纵向（e2e）

- [x] 5.1 `e2e/instance-animation.spec.ts`：页面上放**两个**实例 → 各自绑 `animationTime`
      到页面 setup 的两个导出 → 断言两个实例的旋转不同。
      **前半段做不到，这是实现时才发现的**：组件文档进不了动画模式
      （`workspace-panels.tsx` 明写「组件文档本期不进动画模式」），创建组件也不搬运动画
      清单（`component-library` 里没有任何 `Animations`）。因此组件用示例应用手写的
      「刀闸」资源，authoring 那半段立为路线图**步骤 5b**。
- [x] 5.2 断言用实际渲染出来的变换矩阵，不用属性——组件实例的姿态经过嵌套 Yoga，
      属性上读到的是作者值
- [x] 5.3 组件源未被修改改为在单元层断言（`animation.test.ts`「采样不改动入参文档」）：
      e2e 里没有可观察的入口，而纯函数层的 `toEqual` 断言更强也更直接

## 6. 收口

- [x] 6.1 `bun run lint`
- [x] 6.2 `bun run typecheck`
- [x] 6.3 `bun run test`
- [x] 6.4 `bun run build`
- [x] 6.5 `bun run test:e2e`
- [x] 6.5b 示例组件与两个脚本导出用 `?switch-demo` 开关关掉：默认打开会让项目组件清单、
      资源目录与页面脚本返回成员三张黄金图一起变，与「首页默认不放跳转入口」同一条判断
- [x] 6.6 `bunx openspec validate add-instance-animation --strict`
- [x] 6.7 路线图步骤 5 标记已交付，并把「要在提案里定的是粒度」那段改成结论：
      绑定住在宿主侧，粒度问题不存在
