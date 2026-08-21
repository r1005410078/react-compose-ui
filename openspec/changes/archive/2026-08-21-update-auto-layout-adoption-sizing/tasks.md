# 任务

## 1. 采纳规则

- [x] 1.1 Red：补 stage-engine 手势测试——固定交叉轴子级进入 stretch 容器后变 `fill` 并保留原值；
      `hug`/`fill`、显式 `alignSelf`、非 stretch 父级、column 容器五种情况的期望
  - Red command/result：`bun run --filter @compose-ui/stage-engine test`；2 failed；采纳规则不存在。
- [x] 1.2 Green：规则实现为 core 的 `adoptComposeCrossAxisSizing`，按 `flexDirection` 判定交叉轴
  - 原计划放 stage-engine，但 materials 也需要且不能依赖 stage-engine，因此下沉到共同依赖 core。
- [x] 1.3 接入 `createReparentCommand` 的 Flow 分支
  - `bun run --filter @compose-ui/stage-engine test`；127 passed。

## 2. 启用 Auto Layout 的采纳点

- [x] 2.1 实施时发现的第二个落点：`planEnableComposeAutoLayout` 把已有子级转 Flow 时不碰尺寸，
      而「先放物料再开自动布局」正是最常见路径，提案初稿遗漏
  - Red command/result：`bun run --filter @compose-ui/materials test`；1 failed。
- [x] 2.2 Green：与转 Flow 合并进同一条命令
  - `bun run --filter @compose-ui/materials test`；86 passed。

## 3. 验证

- [x] 3.1 e2e：容器内放两个 Rectangle 后启用 Auto Layout，断言子项填满交叉轴且 Inspector 高度为 Fill
- [x] 3.2 运行 lint、typecheck、test、build、test:e2e
  - 基线遗留未处理：`compose-editor.tsx:1153` 的 refs lint 报错、editor 两条只读资源标签单测。
- [x] 3.3 `openspec validate update-auto-layout-adoption-sizing --strict`

## 4. 修复过期的 e2e（本变更之前就已失败）

- [x] 4.1 恢复合并时丢失的两个 `})`，整个 `integration.spec.ts` 此前无法解析
- [x] 4.2 可访问名子串冲突加 `exact: true`：`选择` 撞「选择边框颜色」、`图表` 撞「绑定/重置 图表标题」
- [x] 4.3 分组默认展开翻转（`entity-inspector.tsx` 回退值改为 `?? true`）：1010、1049、1130、947、1168
      改用 `expandInspectorSection` 或显式折叠，保留各自原本的验证目的
- [x] 4.4 `保存组件 X` → `保存主组件 X`；3916 切回页面标签后补场景树重新挂载的等待
- [x] 4.5 重新生成 10 张过期黄金图，逐张核对 Auto Layout 相关变化
  - 结果：13 failed → 0；762 与 3916 在并行下偶发失败，单跑 3/3 通过，属先于本变更的用例间状态污染。

## 5. 遗留

- [ ] 5.1 采纳后再改 `flexDirection`，旧交叉轴的 `fill` 会落到主轴变成 `flexGrow`。首期接受，
      待定是否在方向变化时回退为 `fixed`（需引入父级属性变化的级联，与既有设计决定冲突）
