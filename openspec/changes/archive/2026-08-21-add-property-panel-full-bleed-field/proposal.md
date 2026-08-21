# 变更：属性面板支持贴边整行的自定义字段

## 原因

全宽自定义 renderer 的内容区虽然已经跨越三列（`grid-column: 1 / -1`），但
`.property-panel__editor--full-width` 还带着 `padding: 5px 6px 6px var(--pp-field-indent)`，
在层深 1 的字段上是左 30px、右 6px 的固定内缩。这条内缩是为普通全宽字段准备的——它让内容与
属性名列自己的 `padding-left: var(--pp-field-indent)` 以及嵌套字段的分支引导线对齐。

但曲线、色带、直方图这类**可视化控件**的判读依赖完整宽度：缓动曲线画布因此在 365px 的
Inspector 里只剩 329px，左侧空出一条与图表无关的竖带；页面脚本的返回成员列表同样被推离行首。
宿主目前只能靠负外边距去抵消属性面板的私有 `--pp-*` token，跨包依赖内部间距值，属性面板一改
padding 就静默错位。

## 变更内容

- `@compose-ui/property-panel` 的 `PropertyPanelRendererLayout` 新增第三个取值 `full-bleed`：
  DOM 结构与 `full-width` 完全一致，只把内容区的左右内缩归零，让 renderer 占满整行宽度。
  renderer 默认布局与字段 metadata 都可以声明它，优先级规则不变。
- `full-bleed` 是显式 opt-in：既有 `full-width` 字段（materials 的 Flex 布局 renderer 等）
  行为与像素位置一律不变。
- Editor 的两个可视化字段改用 `full-bleed`：Canvas Inspector 动画 Section 的缓动曲线画布、
  页面脚本 Section 的返回成员列表。

## 影响

- 受影响的规范：`property-panel`、`editor-workspace-layout`
- 受影响的代码：
  - `packages/property-panel/src/property-panel/compose-property-panel.tsx`（类型与 TSDoc）
  - `packages/property-panel/src/property-tree.tsx`（布局解析与渲染分支）
  - `packages/property-panel/src/styles.css`（贴边 modifier）
  - `packages/editor/src/animation-mode/page-animation-scope-panel.tsx`、
    `packages/editor/src/pages/page-script-scope-panel.tsx`（两个字段 opt-in）
