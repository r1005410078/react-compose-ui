# 变更：修复 Auto Layout 交叉轴拉伸继承

## Why

在父容器上把交叉轴对齐设为「拉伸」，子节点不会跟着拉伸。

根因在 `packages/layout-engine/src/layout-runtime.ts` 的 `applyEntityStyle`：只要 Flow 子级交叉轴是
Hug 且自身 `alignSelf` 是 `auto`，就无条件把 Yoga 的 `alignSelf` 强制成 `flex-start`，完全屏蔽父级
`alignItems` 的效果。

这不是边界情况。`packages/core/src/layout.ts` 的 `createDefaultComposeFlexLayout` 显示新建 Auto
Layout 容器的 `alignItems` 默认值就是 `stretch`，而大多数物料的默认尺寸模式是 Hug，等于这个功能从
容器创建的第一秒起就没有工作过。

这段覆盖逻辑没有被任何 OpenSpec 需求或测试覆盖，属于未记录的实现细节，因此本变更同时把正确语义补成
一条显式需求，避免它再次被无声改掉。

## What Changes

- 移除 `layout-runtime.ts` 中「Hug 交叉轴 + `alignSelf: auto` 时强制 `flex-start`」的覆盖逻辑，让
  Yoga 原生的 `alignSelf: auto` 继承父级 `alignItems` 按标准 Flexbox 语义生效。
- 在 `layout-engine` 能力下新增「Auto Layout 交叉轴拉伸继承」需求，明确 Hug 交叉轴 MUST 保持 Yoga
  auto、子级显式 `alignSelf` MUST 优先于父级 `alignItems`。
- **不采用**"父级设为拉伸时自动把子节点 Fill 复选框勾上"的方案，理由见 design.md。
- 纯渲染层改动，不改变 `ComposeLayoutItem` / `ComposeFlexLayout` 的数据结构或校验规则，不新增文档
  字段。

## 首期边界

- 只修交叉轴 `alignItems` / `alignSelf` 的继承，不调整主轴 `justifyContent` 或 Fill/Hug 求解本身。
- 本修复会改变**已有文档**的视觉结果：任何父级本就是（默认）`stretch`、子级此前因为这段覆盖没有拉伸
  的容器，修复后子级会开始真正拉伸。这是把此前被静默吞掉的行为显形，不是新增能力，但对已经在这个
  状态下调好版式的现有页面是一次可见变化。不做迁移，也不提供兼容开关。
