## 1. v6 文档与迁移

- [x] 1.1 Red：为 v6 Transform/LayoutItem/Layout/GeometryConstraints 严格校验和 v5 拒绝添加 Core 测试。
- [x] 1.2 Green：实现 v6 类型、查询、默认值、验证器和公共导出；更新 fixtures/presets/pages。
- [x] 1.3 Red：为 v5→v6 视觉保持、未知 Component、Layout/constraints 映射和输入不变添加测试。
- [x] 1.4 Green：实现公开迁移结果、冻结 v5 validator 和迁移器。

## 2. Layout Engine 与几何

- [x] 2.1 Red：为 Fixed/Flow/Absolute、Flex、padding、双 gap、wrap、border 和嵌套 Snapshot 添加数值测试。
- [x] 2.2 Green：创建 layout-engine 包、异步 Yoga loader、Runtime、节点生命周期和 Snapshot。
- [x] 2.3 Red：为 Snapshot world matrix/bounds、SceneIndex revision 与 Stage/Preview box 一致性添加测试。
- [x] 2.4 Green：把 stage-engine、scene style、Stage、Editor、Preview 全部切换到 Snapshot。

## 3. Authoring 与嵌套页面

- [x] 3.1 Red：为 Layout/LayoutItem Inspector、Flow/Absolute 转换和 convert-children 命令添加测试。
- [x] 3.2 Green：实现 Materials Inspector 与命令，保持一次操作一次事务。
- [x] 3.3 Red：为 Page Slot v6 嵌套布局、loading/error 和 Runtime 清理添加测试。
- [x] 3.4 Green：增加嵌套文档 render port，并移除 Page Slot 的 Transform-only 递归路径。

## 4. 文档与验证

- [x] 4.1 更新 README、AGENTS、project、包 README、安装与 pack:dry-run 列表及 Changeset。
- [x] 4.2 严格校验 OpenSpec，运行相关包测试、lint、typecheck、build、E2E 与 pack dry-run，记录证据。
