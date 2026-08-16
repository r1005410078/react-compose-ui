## 1. Stage-engine 手柄感知的 Hug 高度保留

- [x] 1.1 `transformedSelection`/`transformedResizeSelection`（`interaction-controller.ts`）新增
  可选 `handle: ResizeHandle` 参数。
- [x] 1.2 `preserveHugHeight` 条件里排除纯高度手柄（`handle === 'n' || handle === 's'`）：拖这两个
  手柄时即使 `layoutItem.height.mode === 'hug'` 也不再回填旧高度。
- [x] 1.3 在实际 resize 手势调用处（`gesture.type === 'resize'` 分支）把 `gesture.handle` 传给
  `transformedResizeSelection`。
- [x] 1.4 确认命令提交阶段（`finished.type === 'resize'` 分支）和 `appendSpatialTransformPatches`
  不需要改动——它们已经按 handle 正确识别高度变化并写 `mode:'fixed'`。

## 2. 测试

- [x] 2.1 `stage-engine` 单测：拖 `n`/`s` 手柄时 Hug 高度 Entity 的预览高度等于拖拽结果，不再回退。
- [x] 2.2 `stage-engine` 单测：拖角手柄（如 `se`）时 Hug 高度 Entity 仍保留原高度（回归保护，不能破坏
  既有"缩窄换行变高"场景）。
- [x] 2.3 Playwright 实测（开发服务器手动验证）：创建一段 Text，拖底部手柄变高，确认属性面板 H
  字段从 `Hug` 变成具体数字（88）；宽度保持 `Hug` 不变。另跑了既有 e2e
  "缩窄文字框时高度跟随内容而不裁剪"（角手柄回归用例）以及 `--grep "文字|resize|Text|拖"`
  下全部 19 条相关用例，均通过；唯一失败的 1 条截图用例（批量拖入 Image/SVG）经 `git stash`
  对照基线提交 768427f 复现，确认与本次改动无关的既有问题。

## 3. 文档与规范

- [x] 3.1 `openspec/changes/add-text-height-resize-drag/specs/basic-materials/spec.md` 的
  MODIFIED 需求与实现一致。
- [x] 3.2 `openspec validate add-text-height-resize-drag --strict` 通过。
