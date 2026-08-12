# 任务

> 每个行为项必须按 Red → Green → Refactor 完成，并在勾选前记录实际命令、结果和原因。

## 1. 规范与设计

- [ ] 1.1 评审 proposal、design 与五份规范增量
- [ ] 1.2 运行 `openspec validate add-instance-structural-overrides --strict` 并记录结果
- [ ] 1.3 确认下钻手势默认绑定，回填 design 的待解决问题

## 2. 覆盖模型

- [ ] 2.1 [Red → Green → Refactor] Core `instanceOverrides` 结构、结构操作分区与属性分区
- [ ] 2.2 [Red → Green → Refactor] `propertyOverrides` → `instanceOverrides` 显式纯迁移与旧字段拒绝
- [ ] 2.3 [Red → Green → Refactor] 实例与 Variant 共用的操作校验器与边界约束（根、基础 Component、越界 reparent）
- [ ] 2.4 [Red → Green → Refactor] 四段解析顺序与 v6 校验失败回退

## 3. 投影与选区

- [ ] 3.1 [Red → Green → Refactor] 复合地址编解码、嵌套拼接与碰撞防护
- [ ] 3.2 [Red → Green → Refactor] SceneTree 惰性内部子树投影与受限能力位
- [ ] 3.3 [Red → Green → Refactor] Editor 从 resolvedSnapshot + 实例操作构建投影节点
- [ ] 3.4 [Red → Green → Refactor] 未展开实例保持单节点的回归

## 4. Stage 下钻

- [ ] 4.1 [Red → Green → Refactor] 命中索引为内部实体建立复合地址条目
- [ ] 4.2 [Red → Green → Refactor] 下钻/退出手势与既有平移、框选的优先级消解
- [ ] 4.3 [Red → Green → Refactor] Stage 与 Scene Tree 选中/展开双向同步

## 5. 编辑与 Apply/Revert

- [ ] 5.1 [Red → Green → Refactor] Inspector 选中复合地址时路由写入 instanceOverrides
- [ ] 5.2 [Red → Green → Refactor] 实例内部删除、reparent、reorder、增删 Component 生成稳定操作
- [ ] 5.3 [Red → Green → Refactor] 实例结构操作单项/全部 Apply 到直接父源与 partial success
- [ ] 5.4 [Red → Green → Refactor] 实例层 Revert、依赖确认与锚点失效的 pending-update

## 6. 集成与交付

- [ ] 6.1 更新示例、README、包 README、公共 TSDoc 与 Changeset
- [ ] 6.2 添加展开内部层级、下钻选中、结构覆盖、Apply/Revert 的 Playwright 场景
- [ ] 6.3 运行 lint、typecheck、test、build、test:e2e、pack dry-run 与 strict OpenSpec 校验
