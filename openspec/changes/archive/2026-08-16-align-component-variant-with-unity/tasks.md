## 1. 产品规则与文案

- [x] 1.1 在 editor / component-library 用户可见文案中固定：主组件、变体、实例；创建变体对话框补充说明句
- [x] 1.2 变体列表/文档头显示「基于 {父显示名}」；实例属性头保持「实例 · …」
- [x] 1.3 文档：`README` 或组件库帮助补一节「主组件 / 变体 / 实例」（各 3～5 句，无 Unity 专有名词亦可）

## 2. 放置与复制只产生实例

- [x] 2.1 [Red → Green] 组件库拖入画布 / external.add 仅创建 component-instance，不写入新 Variant 文件
- [x] 2.2 [Red → Green] 资源浏览器拖入组件媒体类型同上
- [x] 2.3 [Red → Green] 场景树/画布复制实例 → 新实例同一 reference，不创建变体
- [x] 2.4 回归：Preset（Container/Rectangle）拖入行为不变

## 3. 图标

- [x] 3.1 主组件：实心组件符号；变体：空心（或实心+条纹，与 design 选定一致）
- [x] 3.2 页面实例：空心组件符号（非物料矩形图标）
- [x] 3.3 组件库 / 场景树 / 资源列表 accessible name 含「主组件」「变体」或「实例」
- [x] 3.4 单测或视觉契约：Base vs Variant 图标节点可区分

## 4. 从实例创建变体（对齐 Unity）

- [x] 4.1 [Red → Green] 创建变体：parent = 实例当前引用，overrides = 本层 instanceOverrides
- [x] 4.2 [Red → Green] 默认将当前实例 reference 改为新变体，并清空已固化的本层覆盖
- [x] 4.3 对话框：名称校验、失败提示、成功后库可见
- [x] 4.4 e2e：实例改样式 → 创建变体 → 库出现变体 → 实例引用新变体且无重复覆盖

## 5. 变体编辑入口（最小）

- [x] 5.1 组件库可打开变体文档；头或面板可见「变体 · 基于 …」
- [x] 5.2 变体 Apply/Revert/更新父源入口保留，文案与实例侧术语不冲突

## 6. 缺陷修复：实例 Apply 写回主组件（P0）

- [x] 6.1 [Red] 复现并固化失败路径：引用 Base 的实例修改根/内部属性后 Apply 不能更新主组件文档
  - 记录：编辑是否进入 `instanceOverrides`、Apply 是否 save Base、场景事务是否 committed
- [x] 6.2 [Green] instanceRoot 与结构编辑 MUST 稳定写入本层 operations；Apply 全部/单项对 Base
  调用 `applyComposeComponentOverrides` 并 `saveComponent`
- [x] 6.3 [Green] Apply 成功后实例 `resolvedSnapshot` + `remainingOverrides` 经场景事务一次提交；
  失败时 status 区分「主组件未写入」与「主组件已写入、实例待更新」并支持重试
- [x] 6.4 [Green] 写回后第二实例（同引用、无冲突覆盖）经检查更新或自动同步可见主组件变更
- [x] 6.5 e2e：`OpenSpec: … / 实例 Apply 写回主组件`；文案「已写回主组件」或等价
- [x] 6.6 回归：实例引用变体时 Apply 仍写入变体而非误写 Base

## 7. 验证

- [x] 7.1 相关包 typecheck + unit test（editor / component-library）
- [x] 7.2 e2e：`实例 Apply 写回主组件`、`从实例创建变体并改绑`（全量 lint/build 可在合并前再跑）
