## 1. OpenSpec 与 v5 文档模型

- [x] 1.1 Red: 为 v5 Paint 文档、v4 拒绝、几何校验与 Appearance 命令 inverse 写 Core 测试；记录失败证据。
- [x] 1.2 Green: 实现 ComposeColor/ComposePaint、v5 validation、默认值、命令与纯采样/插值模型。
- [x] 1.3 Refactor: 更新 fixture、README、public API docs 和 command regression。

## 2. 共享 Paint 渲染与选择器

- [x] 2.1 Red: 添加 Entity Paint layer、Color/Paint picker、Alpha/Recent/Common/精确输入与 EyeDropper 测试。
- [x] 2.2 Green: 实现共享 layer、Picker、History Provider、Theme/I18n、native 和 fallback port。
- [x] 2.3 Refactor: 添加 Storybook Dark/Light/gradient/disabled states，并通过组件测试与构建。

## 3. Stage Engine 与画布适配

- [x] 3.1 Red: 添加线性/径向/角向 handles、预览、原子提交、取消、图层采样与裁剪/z-order 测试。
- [x] 3.2 Green: 实现无 DOM paint-edit/sample session、snapshot/effect 和 Stage SVG overlay/input adapter。
- [x] 3.3 Refactor: 接入 Editor port、Materials Inspector、快捷键、ARIA 与 locale，保持其它 Stage 手势不变。

## 4. 回归与发布

- [x] 4.1 Red/Green: 更新 Preview、Materials、Property Panel、Editor 测试与 v5 examples。
- [x] 4.2 Refactor: 添加 changeset、黄金图和 README/架构文档；记录 OpenSpec Scenario 映射。
- [x] 4.3 运行 `openspec validate --all --strict`、lint、typecheck、test、storybook build/test、build、pack dry-run、E2E 和 `git diff --check`。
