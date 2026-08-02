## 上下文

第一阶段提供 v6 Snapshot 与 Fixed Flex。Flow 的位置由 parent Layout 决定，因此继续提交 offset
会与布局事实冲突；Scene Tree 已拥有多选排序与跨父级操作，适合作为唯一 Flow 排序入口。

## 目标/非目标

- 目标：增加 Figma 式 Fill，并让现有手势、键盘与结构命令具有确定的布局意图语义。
- 目标：任何手势仍只产生瞬时 preview 和最多一个正式事务。
- 非目标：不在 Stage 中重排 Flow，不允许 Flow Group/Ungroup，不实现 Hug 或内容测量。

## 决策

- Flow 的 main-axis Fill 映射 grow=1、basis=0、shrink=1；cross-axis Fill 覆盖 alignSelf 为 stretch。
- Fixed 明确 shrink=0。Absolute、root 和 free parent 的 Fill 在文档 validator 中被拒绝。
- Stage move/nudge 开始时冻结 Snapshot。选区中每个 Flow 目标在 preview 内先使用 resolved local box
  变为 Absolute，再应用共同位移；pointerup 以一个 batch 写 positioning+offset，cancel 零事务。
- Resize 保持 positioning；被直接调整的 Fill axis 在 preview 中视为 Fixed，pointerup 原子写 Fixed
  与最终 value。Rotation 不改变 sizing/positioning。
- Scene Tree reparent 规则：进入 Layout 一律 Flow；Flow 在 Layout 间保持 Flow；离开 Layout 时用开始
  Snapshot 烘焙 Absolute，Fill axis 变为 resolved Fixed；同父 reorder 只改 childIds。
- Duplicate Flow 插入源后并保持 Flow；Absolute 延续 offset 复制策略。
- Group 或 Ungroup 的任何受影响 Entity 为 Flow 时命令不可用，Stage/context menu/shortcut 使用同一
  pure availability 结果和可读原因。

## 风险/权衡

- 拖动 Flow 会改变 positioning 而非排序 → Stage 在光标和上下文菜单提示，Scene Tree 承担排序。
- reparent 进入 Layout 会立即改变视觉 → 这是已锁定产品语义，Undo 恢复原 parent 与 LayoutItem。
- 多选混合模式复杂 → 同一冻结 Snapshot 统一转换 Flow，单个 batch 保证相对世界几何与撤销原子性。

