## 0. 前置

- [x] 0.1 `add-page-navigation` 已实现且五道验证全绿；本分支从该分支开出，跳转能力先于
      删除到位
- [ ] 0.2 **待用户确认**：线上资产是否存在真实 Page Slot 用量。纯函数降级迁移已交付，
      与该答案无关；答案只决定是否另开一个变更提供编辑器动作「把页面另存为组件」+
      「把 Page Slot 替换为组件实例」作为人工迁移路径

## 1. core

- [x] 1.1 删除基于祖先页面链与深度上限的嵌套状态判定纯函数及其导出
- [x] 1.2 保留页面引用值与判别函数——跳转目标继续使用
- [x] 1.3 新增 page-slot Entity 的显式单向迁移：降级为保留几何与外观的空 Container
- [x] 1.4 迁移返回列出原页面引用的稳定 issue；普通解析返回 legacy issue
- [x] 1.5 单测：降级保几何、issue 内容、迁移不修改输入、迁移不写入 Provider

## 2. materials

- [x] 2.1 删除 `packages/materials/src/page-slot/` 整个目录
- [x] 2.2 从 `create-basic-materials.ts` 移除 Renderer、Preset 与相关导出
- [x] 2.3 移除 `material-icons.tsx` 中的 Page Slot 图标
- [x] 2.4 移除 `material-inspector-kit/renderer-inspectors.tsx` 中的 Page Slot Inspector
- [x] 2.5 移除 `paletteHidden` 说明中对 Page Slot 的引用
- [x] 2.6 确认 Image/SVG 的 Hug measurement 不受影响

## 3. 其余包清理

- [x] 3.1 `stage-engine`：移除 page-slot 的单处引用
- [x] 3.2 `preview`：页面加载端口保留但不再作为槽位递归渲染的 `pageDocumentPort` 透传
- [x] 3.3 `component-registry`：确认 measurement adapter 不再需要 page-slot 分支
- [x] 3.4 `app/src/StageDemo.tsx`：移除 page-slot 演示与 `?deep-page-slot` 入口

## 4. 测试

- [x] 4.1 删除 `packages/materials/src/page-slot/page-slot.test.tsx`
- [x] 4.2 `e2e/materials.spec.ts`：移除 page-slot 相关用例与断言
- [x] 4.3 新增测试：含 page-slot 的旧文档普通解析产生 legacy issue、显式迁移后可正常编辑
- [x] 4.4 回归：组件实例的嵌套、循环检测与动画播放不受影响

## 5. 文档与验证

- [x] 5.1 更新 `AGENTS.md`：`layout-engine` 只用于组件实例的独立嵌套文档 Runtime
- [x] 5.2 更新 `README.md` 与 `openspec/project.md` 中涉及页面嵌套的描述
- [x] 5.3 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e` 全绿
