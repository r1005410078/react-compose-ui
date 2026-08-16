## 上下文

Stage 与 Preview 都消费 parent-local `ComposeLayoutSnapshot`，但交互目标不同：Stage 必须保持稳定
编辑坐标，Preview 应提供最终运行效果。具有 `Hierarchy` 的 Entity 都是容器，不能把 overflow
行为绑定到 Container Renderer。

## 目标/非目标

- 目标：分轴表达溢出、旧文档兼容、Stage 静态提示、Preview 原生滚动。
- 非目标：Stage 虚拟滚动、滚动位置持久化、预览弹框外层画板滚动重构。

## 决策

- 保留 `Clip.enabled` 并增加可选 `horizontal`、`vertical`，避免升级 v6 或引入两个竞争 Component。
- 两个轴必须同时出现或同时省略；省略时由 `enabled` 推导旧语义。
- `scroll + visible` 会由配置命令原子规范化为 `scroll + clip`，避免 CSS 计算值偏离文档语义。
- Core 只输出规范化语义；Stage 和 Preview 分别决定静态提示与原生 CSS。
- 现有共享视觉 API 保持兼容，新消费路径使用不含 overflow 的 appearance helper。

## 风险/权衡

- Stage 提示不代表真实内容比例：固定起点滑块明确其为配置提示，并禁止交互。
- 原生滚动条外观依赖平台：首版保留浏览器行为，优先保证键盘、触控和辅助技术兼容。

## 迁移计划

旧 `{ enabled: boolean }` 文档无需迁移。首次通过新 Inspector 修改后写入完整双轴字段；旧命令继续可用。
