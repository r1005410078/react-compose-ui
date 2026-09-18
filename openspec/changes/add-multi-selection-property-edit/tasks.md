## 1. core：批量规划

- [x] 1.1 `planComposeSetRendererProps`：按 entityIds 把 patch 合到各自 props，产出一条 batch
- [x] 1.2 跳过无 Renderer 与锁定目标；一个都不剩时返回 `null`
- [x] 1.3 单元测试：各自合并、一步撤销、跳过规则

## 2. component-registry：作用对象

- [x] 2.1 `ComposeRendererInspectorProps` 增加可选 `entities`，缺席即 `[entity]`
- [x] 2.2 桥接组件透传

## 3. property-panel：混合值

- [x] 3.1 `mixedPaths` prop 与 Context
- [x] 3.2 字段行输出 `data-property-mixed` 与「多个值」标记
- [x] 3.3 组件测试：标记出现、未列出的字段不受影响、混合字段照常可写

## 4. materials：Inspector 扇出

- [x] 4.1 代表值取 `entity`，混合集合由作用对象算出
- [x] 4.2 写入走 `planComposeSetRendererProps`，单个对象仍走原路径
- [x] 4.3 组件测试：两条曲线改色，各自线宽不变

## 5. editor：多选 Inspector

- [x] 5.1 选区同一种 Renderer 时渲染该 Renderer Inspector
- [x] 5.2 混合类型退回空态
- [x] 5.3 锁定成员计数提示
- [x] 5.4 组件测试 + 端到端：选中多条曲线改色

## 6. 验证

- [x] 6.1 `bun run lint`
- [x] 6.2 `bun run typecheck`
- [x] 6.3 `bun run test`
- [x] 6.4 `bun run build`
- [x] 6.5 `bun run test:e2e`
