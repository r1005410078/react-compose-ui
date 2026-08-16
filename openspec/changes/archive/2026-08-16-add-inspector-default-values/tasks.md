# 任务

## 1. 协议与基线来源

- [x] 1.1 确认 Component Definition / Renderer Definition 暴露默认值的方式（复用既有默认 Component
      值还是新增只读字段），并补充 TSDoc
- [x] 1.2 默认值下沉到无依赖的 `builtin-component-defaults.ts`，由 Registry 定义与 Inspector 共用；
      基线在各 Inspector 内按其 schema 直接构造，无需额外派生函数

## 2. Materials Inspector 接线

- [x] 2.1 Appearance Inspector 传入结构化基线（Solid backgroundPaint、borderWidth/borderRadius 0、
      opacity 1），Red → Green 验证重置动作出现并恢复默认背景
- [x] 2.2 几何 Inspector 传入 rotation/margin/alignSelf 基线，位置与尺寸不参与
- [x] 2.3 Visibility、Lock、Hierarchy 等其余内建 Component Inspector 接入基线
- [x] 2.4 Renderer Inspector 使用 Definition 默认 props 作为基线，并验证重置保留 schema 之外的
      宿主字段
- [x] 2.5 基线以 `useMemo` 稳定引用，避免每次渲染重建导致的无谓比较

## 3. Editor Canvas Inspector

- [x] 3.1 用固定默认输出尺寸与背景替换 `defaultValue={value}`
- [x] 3.2 补充测试：背景偏离默认时显示重置，执行后提交一次可逆 `output.configure`

## 4. 文档与验证

- [x] 4.1 更新 `packages/property-panel/README.md`，说明重置与“已修改”筛选依赖宿主提供稳定
      `defaultValue`
- [x] 4.2 运行 `bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`
- [x] 4.3 运行 `bun run test:e2e`（涉及编辑器 Inspector 交互）；`背景填充` 断言补 `exact: true`，
      避免匹配到新的 `重置 背景填充`。`integration.spec.ts:157/790/1144` 在本变更前的基线提交
      已失败，与本变更无关
- [x] 4.4 `openspec validate add-inspector-default-values --strict`
