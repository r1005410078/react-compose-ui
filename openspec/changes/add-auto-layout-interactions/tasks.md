## 1. Fill 文档与求解

- [ ] 1.1 Red：为合法/非法 Fill 组合、main/cross axis 映射与 wrap 添加 Core/Layout Engine 测试。
- [ ] 1.2 Green：扩展 v6 AxisSizing、validator、Inspector 与 Yoga style mapper。

## 2. Stage 变换

- [ ] 2.1 Red：为 Flow move/nudge 转 Absolute、混合多选、cancel 与单事务添加 controller/Stage 测试。
- [ ] 2.2 Green：实现 Snapshot 冻结、absolute preview 与原子 layout-item batch。
- [ ] 2.3 Red：为 Fill resize 转 Fixed、rotation 保持 Flow 和约束添加测试。
- [ ] 2.4 Green：实现 resize sizing command 与 Overlay/Inspector 反馈。

## 3. Scene Tree 与结构命令

- [ ] 3.1 Red：为移入 Layout→Flow、跨 Layout、移出烘焙、排序和 Duplicate 添加 planner/command 测试。
- [ ] 3.2 Green：更新 reparent/duplicate 规划并使用 Snapshot。
- [ ] 3.3 Red：为 Flow Group/Ungroup 快捷键、菜单和 pure availability 添加测试。
- [ ] 3.4 Green：统一禁用入口和可读原因。

## 4. 验证

- [ ] 4.1 增加完整编辑纵向 E2E 与黄金图，更新公开文档。
- [ ] 4.2 严格校验 OpenSpec，运行全量质量门禁并记录 Red/Green/Regression 证据。

