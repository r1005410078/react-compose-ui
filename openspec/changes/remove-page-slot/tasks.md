## 0. 前置

- [x] 0.1 `add-page-navigation` 已实现且五道验证全绿；本分支从该分支开出，跳转能力先于
      删除到位
- [x] 0.2 已确认项目尚未上线到任何客户现场，Page Slot 只存在于示例应用——**不提供任何
      迁移路径**，删除即完成

## 1. core

- [x] 1.1 删除基于祖先页面链与深度上限的嵌套状态判定纯函数及其导出
- [x] 1.2 保留页面引用值与判别函数——跳转目标继续使用
- [x] 1.3 **确认不做**迁移器：无线上资产，为零份文档写迁移是负债
- [x] 1.4 **确认不做** legacy issue：残留 Entity 落到 Registry 既有的「未知 Renderer」占位，
      几何与外观保留且占位可访问，不会静默丢失内容
- [x] 1.5 无迁移代码即无迁移单测；`readComposePageReference` 的既有单测保留

## 2. materials

- [x] 2.1 删除 `packages/materials/src/page-slot/` 整个目录
- [x] 2.2 从 `create-basic-materials.ts` 移除 Renderer、Preset 与相关导出
- [x] 2.3 移除 `material-icons.tsx` 中的 Page Slot 图标
- [x] 2.4 移除 `material-inspector-kit/renderer-inspectors.tsx` 中的 Page Slot Inspector
- [x] 2.5 移除 `paletteHidden` 说明中对 Page Slot 的引用
- [x] 2.6 确认 Image/SVG 的 Hug measurement 不受影响

## 3. 其余包清理

- [x] 3.1 `stage-engine`：移除 page-slot 的单处引用
- [x] 3.2 `preview`：`pageLoader` 保留但只服务导航，不再注入 Registry 渲染上下文
- [x] 3.3 `component-registry`：删除 `pageDocumentPort` 端口本身——它只为 Page Slot 存在；
      `stage` 与 `editor` 的 `pageLoader` 选项随之删除
- [x] 3.5 删除弃用别名 `ComposePageDocumentLoader` / `createComposePageDocumentLoader`
- [x] 3.4 `app/src/StageDemo.tsx`：移除 page-slot 演示与 `?deep-page-slot` 入口

## 4. 测试

- [x] 4.1 删除 `packages/materials/src/page-slot/page-slot.test.tsx`
- [x] 4.2 `e2e/materials.spec.ts`：移除 page-slot 相关用例与断言
- [x] 4.3 **确认不做**：没有迁移器就没有要测的迁移行为
- [x] 4.4 回归：组件实例的嵌套、循环检测与动画播放不受影响

## 5. 文档与验证

- [x] 5.1 更新 `AGENTS.md`：`layout-engine` 只用于组件实例的独立嵌套文档 Runtime
- [x] 5.2 更新 `README.md` 与 `openspec/project.md` 中涉及页面嵌套的描述
- [x] 5.3 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e` 全绿
