# 任务

> 每个行为项必须按 Red → Green → Refactor 完成，并在勾选前记录实际命令、结果和原因。

## 1. 规范与设计

- [x] 1.1 评审 proposal、design 与五份规范增量
  - Result: 已确认。
- [x] 1.2 运行 `openspec validate add-instance-structural-overrides --strict` 并记录结果
  - Result: Change valid。
- [x] 1.3 确认下钻手势默认绑定，回填 design 的待解决问题
  - Result: 采用双击；复用 InteractionController 已归一化的 clickCount，与 textEditable 守卫的文本原地编辑天然互斥，无需优先级仲裁。

## 2. 覆盖模型

- [x] 2.1 [Red → Green → Refactor] Core `instanceOverrides` 结构、结构操作分区与属性分区
  - Red: `bun run --cwd packages/core test -- component-instance-overrides.test.ts`；5 failed；parse/migrate/resolve API 均不存在。
  - Green/Refactor: 同一命令 6 passed；分区类型与 TSDoc 完成，公共入口导出。
- [x] 2.2 [Red → Green → Refactor] `propertyOverrides` → `instanceOverrides` 显式纯迁移与旧字段拒绝
  - Red/Green: 同上 suite；缺少 properties/operations 分区一律返回 component-asset.legacy，迁移后结构分区为空。
- [x] 2.3 [Red → Green → Refactor] 实例与 Variant 共用的操作校验器与边界约束（根、基础 Component、越界 reparent）
  - Result: 直接复用 applyComposeComponentOverrides，其已强制根不可删/移、基础 Component 不可删、单 Group 根；补充越界 reparent 用例。
- [x] 2.4 [Red → Green → Refactor] 四段解析顺序与 v6 校验失败回退
  - Result: resolveComposeInstanceOverrides 固定 结构操作 → 属性覆盖；任一阶段失败不返回半应用文档。

## 3. 投影与选区

- [x] 3.1 [Red → Green → Refactor] 复合地址编解码、嵌套拼接与碰撞防护
  - Red: `bun run --cwd packages/core test -- component-instance-path.test.ts`；6 failed（先收紧 toThrowError 断言，避免调用不存在函数导致的假绿）。
  - Green/Refactor: 同一命令 6 passed；分隔符禁入 Entity ID，段数上限为嵌套上限两倍。
- [x] 3.2 [Red → Green → Refactor] SceneTree 惰性内部子树投影与受限能力位
  - Red: `bun run --cwd packages/scene-tree test -- compose-scene-tree.test.tsx`；1 failed；未物化 children 的节点不渲染 aria-expanded，展开控件缺失。
  - Green/Refactor: 同一命令 39 passed；节点模型新增 hasChildren 供宿主惰性物化时显式声明；Playwright 探针在真实应用中确认展开后出现内部节点。
  - 修正：首版只在 controller 用例里直接调用 onExpandedChange，绕过了展开控件，掩盖了 adapter 只按 children 长度推断 hasChildren 的死锁。
- [x] 3.3 [Red → Green → Refactor] Editor 从 resolvedSnapshot + 实例操作构建投影节点
  - Red: `bun run --cwd packages/editor test -- controller.test.tsx`；1 failed；实例节点 canHaveChildren 为 false，无法展开。
  - Green/Refactor: 同一命令 26 passed；projectInstanceChildren 按展开集合惰性构建，validExpanded 放行实例与复合地址。
- [x] 3.4 [Red → Green → Refactor] 未展开实例保持单节点的回归
  - Result: 同一用例断言未展开时 children 为 undefined，不构建投影。

## 4. Stage 下钻

- [x] 4.1 [Red → Green → Refactor] 命中索引为内部实体建立复合地址条目
  - Result: 改为 DOM 命中而非扩展 stage-engine 场景索引——内部几何只存在于嵌套 Runtime，且编辑态内容 pointer-events 关闭，elementsFromPoint 会跳过。逻辑抽为 instance-drilldown 纯函数并单测。
- [x] 4.2 [Red → Green → Refactor] 下钻/退出手势与既有平移、框选的优先级消解
  - Result: 只在 select 工具、偶数 clickCount 上下钻，保证一次双击恰好一层；与 textEditable 守卫的原地编辑天然互斥。下钻上下文存于 ref，因为奇数 pointerdown 会先把选区重置回实例。
- [x] 4.3 [Red → Green → Refactor] Stage 与 Scene Tree 选中/展开双向同步
  - Result: 选中复合地址时自动展开宿主实例与内部祖先链；Playwright 覆盖单击选实例、两次双击逐层深入。
  - Stage overlay 为内部实体绘制虚线只读选中框，几何由 DOM 测量（instance-selection-bounds），不带手柄。
  - 未完成：Inspector 尚未路由到实例覆盖（见 5.1）。

## 5. 编辑与 Apply/Revert

- [ ] 5.1 [Red → Green → Refactor] Inspector 选中复合地址时路由写入 instanceOverrides
- [ ] 5.2 [Red → Green → Refactor] 实例内部删除、reparent、reorder、增删 Component 生成稳定操作
- [ ] 5.3 [Red → Green → Refactor] 实例结构操作单项/全部 Apply 到直接父源与 partial success
- [ ] 5.4 [Red → Green → Refactor] 实例层 Revert、依赖确认与锚点失效的 pending-update

## 6. 集成与交付

- [ ] 6.1 更新示例、README、包 README、公共 TSDoc 与 Changeset
- [ ] 6.2 添加展开内部层级、下钻选中、结构覆盖、Apply/Revert 的 Playwright 场景
- [ ] 6.3 运行 lint、typecheck、test、build、test:e2e、pack dry-run 与 strict OpenSpec 校验
