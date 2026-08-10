## 上下文

Figma 的单击文字创建自动宽度文字，拖拽创建固定尺寸文字；Text 的 Fill 与字体排版相互独立。本仓库已经由 LayoutItem 的 `hug` 和 Renderer measurement 支持内容尺寸，因此不需要新增 core schema 或在 Stage 中测量 DOM。

## 目标/非目标

- 目标：新 Text 的默认视觉和创建尺寸符合 Figma 基础工作流，选区在布局测量后贴合文字。
- 目标：Inspector、Stage、Preview 和 measurement 使用同一 Text 属性语义。
- 目标：旧文档不被批量改写，显式属性不改变。
- 非目标：不实现富文本范围样式、Text Style、最近使用字体状态、自动进入文字编辑或 Figma 的全部排版能力。

## 决策

- 新建默认 Props 为 `text: 'Text'`、`color: '#ffffff'`、`fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'`、`fontSize: 12`、`fontWeight: 400`、`letterSpacing: 0`、`textAlign: 'left'`、`verticalAlign: 'top'`、`textCase: 'original'`、`textDecoration: 'none'`。`lineHeight` 缺失表示 Auto，不在默认 Props 中固化数值。
- Text 采用独立的 Preset component builder：两轴均为 `hug`，回退值为 28×16，只在同步测量缺失时使用。其他通用 Material Preset 继续使用固定尺寸。
- Stage 将 click 识别为 width 与 height 都小于 1 的 Text drawing commit：此时保留 seed 的 Hug axes，仅把 offset 放在点击点；drag 才强制两轴 fixed。这样 Stage 不读取或计算实际字体尺寸。
- Renderer 使用 CSS text-align、flex align-items、text-transform、font-variant-caps 和 text-decoration-line；measurement host 应用会影响文字字形/大小的 case 属性。
- 旧 document 缺失的新排版字段时，Renderer 保持旧的垂直居中、原始大小写、无装饰。缺失颜色统一显示为白色；旧节点原来已显式写入的深色和字号不改变。

## 风险/权衡

- 浏览器缺少 Inter 时会使用系统 fallback，测量与渲染仍应用相同 family stack，待字体 ready 后 measurement revision 重排。
- `hug` 的首帧使用小回退尺寸而非测量 DOM，避免 Stage adapter 与 DOM 耦合；最终 box 由现有 Layout Runtime 收敛。

## 迁移计划

不执行文档迁移。新创建的 Text 立刻采用新 Props 与 sizing；旧实体在读取时按兼容默认值渲染。

## 待解决问题

无。
