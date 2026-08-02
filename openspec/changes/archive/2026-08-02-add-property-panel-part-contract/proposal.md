# 变更：属性面板结构 Part 样式契约

## 原因

`@compose-ui/materials` 的 Auto Layout Inspector 需要把属性面板重排成两列紧凑网格、隐藏工具栏并
去掉字段外壳。现状是直接用 CSS 选中 `@compose-ui/property-panel` 的内部 BEM 类名实现的——
`property-panel__toolbar`、`__fields`、`__ungrouped`、`__field`、`__label`、`__editor`、`__actions`、
`__control` 共 12 处选择器（另有 3 处因为 DOM 结构变化早已失效，已随本轮清理删除）。

这些类名是 property-panel 的实现细节，不在任何规范里：

- property-panel 调整自身 DOM 结构或类名时，materials 的排版会静默错位，只有 E2E 黄金图能发现。
- 现有的受支持钩子只覆盖字段级（`data-property-path` / `data-property-layout` / `data-property-depth`
  / `data-property-nested`），不覆盖结构容器，所以 materials 没有合规的替代写法。
- 「属性面板视觉与样式隔离」只承诺了 CSS 变量级的密度覆盖，无法表达「换一种字段外壳」。

## 变更内容

- property-panel 为结构容器发布稳定的 `data-property-part` 契约（toolbar、separator、fields、
  ungrouped、field、label、editor、actions、control），并纳入规范与 TSDoc。
- materials 的 Auto Layout Inspector 改用该契约选择器，不再引用任何 `property-panel__*` 内部类名。
- 补一条护栏测试：materials 的样式表不得出现 `property-panel__` 前缀。

## 影响

- 受影响规范：property-panel、basic-materials。
- 受影响包：property-panel（新增 DOM 属性，不改组件 API）、materials（改写选择器）。
- 兼容性：纯新增属性，现有类名保持不变，宿主既有覆盖不受影响；本变更只把 materials 迁移到新契约。
- 验证：需要重跑 Inspector 相关 E2E 黄金图，确认选择器迁移没有像素级回归。
