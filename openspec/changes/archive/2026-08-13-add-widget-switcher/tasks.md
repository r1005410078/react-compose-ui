# 任务

## 1. core 文档语义

- [x] 1.1 红测：`activeIndex` 越界钳制、空容器返回 null、非 switcher 容器不产生隐藏项
- [x] 1.2 红测：预览覆盖优先于 `activeIndex`，且只作用于命中的那个 switcher
- [x] 1.3 新增 `WidgetSwitcher` Component Key、类型、accessor 与 validator
- [x] 1.4 实现活动子项解析与隐藏集合派生纯函数，并从公共入口导出

## 2. materials 物料

- [x] 2.1 红测：`widget-switcher` Preset seed 合法，带 Hierarchy 与 `activeIndex: 0`
- [x] 2.2 红测：`widget-switcher` 能力给已有容器追加 WidgetSwitcher 且不动既有 childIds
- [x] 2.3 红测：Inspector 编辑索引派发一条 `component.update`
- [x] 2.4 实现 Preset、图标、Component 定义、能力与 Inspector，并接入公共入口

## 3. 只渲染活动子项

- [x] 3.1 红测：Stage 场景层只渲染活动子项
- [x] 3.2 红测：Preview 只渲染活动子项，且忽略任何预览覆盖
- [x] 3.3 Component Instance 与 Page Slot 的嵌套 Runtime 复用同一条 `resolveComposeRenderedChildIds`
      路径（由 core 单测覆盖规则本身，未再为两个 Runtime 各写一份重复渲染断言）
- [x] 3.4 红测：SceneIndex 把非活动子项及其后代标记为不可见，命中测试不返回它们
- [x] 3.5 实现四处渲染入口与 SceneIndex 的隐藏接入
- [x] 3.6 回归确认：切换索引不改变 Layout Snapshot，非活动子项尺寸不变

## 4. 选中即预览

- [x] 4.1 红测：选中非活动子项的后代时该分支可见且可命中
- [x] 4.2 红测：预览不派发任何命令，不产生文档事务
- [x] 4.3 红测：取消选择后回到 `activeIndex`
- [x] 4.4 实现 Stage 的预览派生并同时喂给渲染与 SceneIndex

## 5. 端到端

- [x] 5.1 e2e：创建 WidgetSwitcher、拖入两个子项、断言只显示第一个
- [x] 5.2 e2e：Inspector 改索引切到第二个子项
- [x] 5.3 e2e：场景树选中第一个子项时它临时显示，取消选择后回到索引 1

## 6. 验证

- [x] 6.1 `bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`
- [x] 6.2 `bun run test:e2e`（新增用例通过；仓库既有 26 条失败与本变更无关，
      基线 df80a76 上完全一致）
- [x] 6.3 同步 README 与 `openspec/project.md`（如有需要），归档 change
