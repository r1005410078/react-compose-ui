# 任务

> 每个行为项必须按 Red → Green → Refactor 完成，并在勾选前记录实际命令、结果和原因。

## 1. 规范与设计

- [x] 1.1 评审 proposal、design 与四份规范增量
  - Result: 已确认。
- [x] 1.2 运行 `openspec validate update-component-instance-contract --strict` 并记录结果
  - Result: Change valid。

## 2. 删除暴露属性

- [x] 2.1 [Red → Green → Refactor] Core 删除属性定义类型、Base `properties` 与覆盖属性分区
  - Red: `bun run --cwd packages/core test -- component-properties-removal`；5 failed。
  - Green/Refactor: 5 passed。属性定义类型标记 @deprecated 保留，因为迁移仍需读取旧 target；snapshot 与 Base 的 properties 字段删除。
- [x] 2.2 [Red → Green → Refactor] 旧 Base 文件与旧实例属性分区的显式纯迁移，渲染输出不变
  - Result: Base 迁移丢弃 properties 字段、文档不变。实例侧扁平 propertyOverrides 与含 properties 分区的对象都可迁移。
  - 已知有损点：属性覆盖需要 Base 定义才能还原字段目标，而定义随暴露属性一并删除，因此无法还原的覆盖被丢弃而不是保留成无目标操作（后者会在解析期整体失败）。
- [x] 2.3 [Red → Green → Refactor] 解析顺序收敛为 Base → Variant 链 → 实例结构操作
  - Result: resolveComposeInstanceOverrides 退化为单纯的操作应用，四段顺序不再存在。
- [x] 2.4 [Red → Green → Refactor] 移除 Base 暴露属性面板与实例属性覆盖 UI
  - Result: 删除 base-properties-panel 包目录与 editor 接线；实例覆盖面板重写为逐条列出结构操作并支持单项/全部 Apply、Revert。

## 3. 组件根放宽

- [x] 3.1 [Red → Green → Refactor] Parser 与 Applier 的根约束从「单 Group 根」放宽为「单根」
  - Red: `bun run --cwd packages/core test -- component-root-relaxation`；2 failed（多根拒绝本就正确）。
  - Green/Refactor: 3 passed。单根仍是硬约束——diff 与操作应用都依赖父子共享同一根 ID；materials renderer 的同一校验一并放宽。
- [x] 3.2 [Red → Green → Refactor] 提取器单选时复用已有节点作为组件根，多选仍生成 Group
  - Red: `bun run --cwd packages/stage-engine test -- component-extraction`；1 failed；单选 Container 仍被包进 unused-wrapper。
  - Green/Refactor: 5 passed。reuseGroup 改为 reuseRoot，条件从「是 first-class Group」放宽为「单选」。
- [x] 3.3 [Red → Green → Refactor] 两条路径的世界几何、旋转与 sibling 顺序回归
  - Result: stage-engine 95 tests 通过，含复用路径根坐标归零断言；两条 e2e 因契约变化更新为嵌套两层容器，仍覆盖逐层下钻。

## 4. 实例几何跟随组件根

- [ ] 4.1 [Red → Green → Refactor] 实例 LayoutItem 与 GeometryConstraints 从组件根派生
- [ ] 4.2 [Red → Green → Refactor] 尺寸、外观、裁剪与 Auto Layout 编辑写入以组件根为目标的实例覆盖
- [ ] 4.3 [Red → Green → Refactor] Stage Resize 手柄与 Inspector 分组在实例上可用

## 5. 自动同步

- [ ] 5.1 [Red → Green → Refactor] 组件源保存后依赖实例的冲突判定与无冲突自动提交
- [ ] 5.2 [Red → Green → Refactor] 存在失效覆盖时进入 pending-update 并保留旧快照
- [ ] 5.3 [Red → Green → Refactor] 自动与手动路径共用同一次事务，Undo 可回退

## 6. 集成与交付

- [ ] 6.1 更新示例、README、AGENTS、project.md、包 README、公共 TSDoc 与 Changeset
- [ ] 6.2 添加单选提取无冗余层级、实例 Resize、自动同步与冲突确认的 Playwright 场景
- [ ] 6.3 运行 lint、typecheck、test、build、test:e2e、pack dry-run 与 strict OpenSpec 校验
