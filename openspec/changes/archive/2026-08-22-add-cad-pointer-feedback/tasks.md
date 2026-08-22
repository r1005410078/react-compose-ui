# 任务

## 1. 橡皮筋预览
- [x] 1.1 `CadPreviewSegment` 增加 `pending` 标记，图面按虚线渲染并带 `data-cad-preview-pending`
- [x] 1.2 `ComposeCadCanvas` 在等待取点且有参照点时，把 `reference → resolveCadPoint(hover)` 追加为 pending 段
- [x] 1.3 组件测试：取第一点后移动指针出现 pending 段；开正交时它是水平/垂直的；命令结束后消失

## 2. 悬停高亮
- [x] 2.1 `ComposeCadCanvas` 在 `prompt` 不接受 point 时用 `findCadHit` 求悬停图元
- [x] 2.2 图面渲染 `data-hovered`，样式区别于选中态
- [x] 2.3 组件测试：压在图元上高亮；命令吃点时不高亮；移开后消失

## 3. 坐标读数
- [x] 3.1 命令行显示指针世界坐标，指针离开图面时隐藏
- [x] 3.2 组件测试：移动指针后读数跟随；离开后消失

## 4. 命中容差
- [x] 4.1 `pickRadius` 默认值改 8 并更新 TSDoc

## 5. 端到端与验证
- [x] 5.1 e2e：`L↵` 取第一点后移动指针可见橡皮筋，悬停图元高亮
- [x] 5.2 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
