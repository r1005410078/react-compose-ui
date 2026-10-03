# 任务

## 1. 提取准备管线（先保证预览不回归）

- [ ] 1.1 `materials/component-instance/prepare.ts`：纯函数与可判别结果（先写用例）
- [ ] 1.2 `renderer.tsx` 改为调用它；祖先链经参数传入
- [ ] 1.3 回归：materials 组件测试、`instance-animation` / `instance-content-fit` / `component-library` e2e
- [ ] 1.4 公开入口与 TSDoc

## 2. 导出器

- [ ] 2.1 `instances` 输入与复合地址
- [ ] 2.2 实例映射：裁剪、翻转、内容缩放、id 前缀
- [ ] 2.3 嵌套实例递归；缺失与失败的占位兜底

## 3. 编辑器

- [ ] 3.1 逐实例准备与求解（递归、去重），异步导出与进行中提示
- [ ] 3.2 组件测试与 e2e：导出含实例的场景

## 4. 验收

- [ ] 4.1 实例夹具（覆盖、`contentFit: scale`、翻转、嵌套一层），`?qt-reference` 走同一条求解路径
- [ ] 4.2 像素对比通过

## 5. 文档与验证

- [ ] 5.1 `AGENTS.md`：准备管线的归属与「预览与导出共用」的判据
- [ ] 5.2 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
- [ ] 5.3 `npx openspec validate add-qml-instance-export --strict`
