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


## 5. 编辑与 Apply/Revert

- [x] 5.1 [Red → Green → Refactor] Inspector 选中复合地址时路由写入 instanceOverrides
  - Red: `bun run --cwd packages/editor test -- controller.test.tsx`；1 failed；instanceInnerSelection 不存在。
  - Green/Refactor: 28 passed。命令先在内部文档的一次性 Runtime 执行，再用 diffComposeComponentDocuments 与未施加实例覆盖的快照做稳定 diff，重算整份操作列表后一次写回宿主；重算而非追加，避免同一字段反复编辑累积等价操作。
  - name 不是 Component 字段、稳定操作代数无法表达重命名，因此内部节点 Inspector 的名称字段设为只读，而不是留成静默失效的输入。
- [x] 5.2 [Red → Green → Refactor] 实例内部删除、reparent、reorder 生成稳定操作
  - Red: `bun run --cwd packages/editor test -- controller.test.tsx`；1 failed；内部场景树操作仍走宿主文档。
  - Green/Refactor: 29 passed；场景树操作翻译为内部文档命令后复用 applyInstanceInnerCommands 写回；越界（parentId 为宿主根或跨实例）整体拒绝。
  - 能力位只放行已接线的删除与移动；重命名、可见性、锁定保持关闭，因为稳定操作代数无法表达。
  - 未接线：create/duplicate 需要在实例覆盖里生成稳定 ID；增删 Component 暂未提供入口。
- [x] 5.3 [Red → Green → Refactor] 实例结构操作单项/全部 Apply 到直接父源与 partial success
  - Red: `bun run --cwd packages/component-library test -- instance-operations`；2 failed；applyComposeInstanceOverrides 不存在。
  - Green/Refactor: 8 passed。结构操作 Apply 到 Variant 父源时原样并入其操作列表，父源是 Base 时由同一 Applier 落到文档；结构排在属性之前，与解析顺序一致。
  - 删除旧的 applyComposeInstancePropertyOverrides：新函数是其超集，保留两份近乎相同的实现会漂移。
  - 面板 onChange 改为回传完整覆盖对象：只回传属性映射会让结构覆盖被静默丢弃；Apply/Revert 在只有结构覆盖时同样可用。
- [ ] 5.4 [Red → Green → Refactor] 实例层 Revert、依赖确认与锚点失效的 pending-update

## 6. 集成与交付

- [x] 6.1 更新示例、README、包 README、公共 TSDoc 与 Changeset
  - Result: README 完成度、AGENTS 协议摘要、project.md 约束、core/component-library/scene-tree 包 README 与 Changeset 已同步。project.md 中「不支持从页面场景直接编辑实例内部结构」的旧约束正是本变更推翻的，已改写。
  - 示例应用无需新增演示代码：创建组件、展开投影、下钻与内部编辑的完整流程已可在其中操作，Playwright 场景即基于它运行。
- [x] 6.2 添加展开内部层级、下钻选中、结构覆盖、Apply/Revert 的 Playwright 场景
  - Result: 新增「双击逐层下钻并与场景树同步」（含单击选实例、逐层下钻、只读选中框无手柄、Inspector 路由、名称只读）与「内部删除写入覆盖且越界拖拽被拒绝」；另有创建组件重名提示场景。
- [x] 6.3 运行 lint、typecheck、test、build、test:e2e、pack dry-run 与 strict OpenSpec 校验
  - Result: `bun run lint` 通过；`bun run typecheck` 42/42；`bun run test` 41/41；`bun run build` 22/22；`bunx playwright test` 53/53；`bun run pack:dry-run` 全包通过；`bunx openspec validate add-instance-structural-overrides --strict` Change valid。
