## 0. 前置

- [ ] 0.1 确认 `add-page-navigation` 已实现并合入——跳转可用之前不得开始本变更
- [ ] 0.2 盘点线上资产中的 Page Slot 用量，决定是否需要另开编辑器辅助迁移变更

## 1. core

- [ ] 1.1 删除基于祖先页面链与深度上限的嵌套状态判定纯函数及其导出
- [ ] 1.2 保留页面引用值与判别函数——跳转目标继续使用
- [ ] 1.3 新增 page-slot Entity 的显式单向迁移：降级为保留几何与外观的空 Container
- [ ] 1.4 迁移返回列出原页面引用的稳定 issue；普通解析返回 legacy issue
- [ ] 1.5 单测：降级保几何、issue 内容、迁移不修改输入、迁移不写入 Provider

## 2. materials

- [ ] 2.1 删除 `packages/materials/src/page-slot/` 整个目录
- [ ] 2.2 从 `create-basic-materials.ts` 移除 Renderer、Preset 与相关导出
- [ ] 2.3 移除 `material-icons.tsx` 中的 Page Slot 图标
- [ ] 2.4 移除 `material-inspector-kit/renderer-inspectors.tsx` 中的 Page Slot Inspector
- [ ] 2.5 移除 `paletteHidden` 说明中对 Page Slot 的引用
- [ ] 2.6 确认 Image/SVG 的 Hug measurement 不受影响

## 3. 其余包清理

- [ ] 3.1 `stage-engine`：移除 page-slot 的单处引用
- [ ] 3.2 `preview`：页面加载端口保留但不再作为槽位递归渲染的 `pageDocumentPort` 透传
- [ ] 3.3 `component-registry`：确认 measurement adapter 不再需要 page-slot 分支
- [ ] 3.4 `app/src/StageDemo.tsx`：移除 page-slot 演示与 `?deep-page-slot` 入口

## 4. 测试

- [ ] 4.1 删除 `packages/materials/src/page-slot/page-slot.test.tsx`
- [ ] 4.2 `e2e/materials.spec.ts`：移除 page-slot 相关用例与断言
- [ ] 4.3 新增测试：含 page-slot 的旧文档普通解析产生 legacy issue、显式迁移后可正常编辑
- [ ] 4.4 回归：组件实例的嵌套、循环检测与动画播放不受影响

## 5. 文档与验证

- [ ] 5.1 更新 `AGENTS.md`：`layout-engine` 只用于组件实例的独立嵌套文档 Runtime
- [ ] 5.2 更新 `README.md` 与 `openspec/project.md` 中涉及页面嵌套的描述
- [ ] 5.3 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e` 全绿
