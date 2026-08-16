# 变更：对齐 Unity 的主组件 / 变体 / 实例产品模型

## Why

Compose 的数据协议已接近 Unity Prefab 体系（Base ≈ Prefab、Variant ≈ Prefab Variant、
页面 component-instance ≈ Scene Instance），但产品入口与图标叙事不清晰：

1. 团队多为一般程序员，不熟悉 Figma/Unity；「变体」易与「实例」混淆。
2. 拖入画布、复制等默认路径若被误解为「建变体」，会造成资源爆炸并破坏共用模板。
3. 主组件 / 变体 / 实例在库、场景树、属性头缺少统一图标与文案规则。
4. 「从实例创建变体」虽有实现，闭环（命名、入库、是否改绑当前实例）与 Unity「拖实例到
   Project 选 Prefab Variant」的产品完整度仍有差距。
5. **缺陷（P0）**：用户可在页面上改实例（本地覆盖/下钻编辑），但「写回主组件 / Apply 到
   直接父源」端到端不可用或失败后不可恢复（例如仅资源写入成功、场景事务未提交，或根属性
   编辑未进入 `instanceOverrides` 导致 Apply 无操作可写）。这与 Unity「实例 Overrides →
   Apply to Prefab」及本仓库既有 `applyComposeInstanceOverrides` 契约不一致。

本变更**不重写协议代数**，而是把**入口、图标、文案与创建闭环**对齐 Unity 心智，并固定
中文产品用语（保留「变体」一词，配固定解释）；同时**修复实例回写主组件（直接父源）**缺陷。

## What Changes

### 产品模型（对齐 Unity）

| Unity | Compose 产品用语 | 存储 |
|---|---|---|
| Prefab | **主组件** | Base asset |
| Prefab Variant | **变体** | Variant asset（parentRef + ops） |
| Scene Prefab Instance | **实例** | 页面 Entity + component-instance |

解析顺序保持：`Base → Variant 链 → 实例结构覆盖`。

### 放置与复制（关键纠正）

- **从组件库 / 资源拖入画布** MUST 只创建**实例**（引用被拖资源），MUST NOT 自动新建变体资源。
- **画布上复制 / 副本实例** MUST 创建**另一实例**（同一引用），MUST NOT 自动新建变体。
- **创建变体** MUST 为显式动作（对齐 Unity 拖实例到 Project 选 Variant），入口包括：
  - 选中实例 →「创建变体…」
  - （可选）组件库对主组件/变体 →「创建变体…」

### 从实例到变体（对齐 Unity）

当用户从实例创建变体时，系统 MUST：

1. 以实例当前引用的组件为**父源**（Base 或 Variant）；
2. 将实例**本层** `instanceOverrides` 固化为新变体的 `overrides`；
3. 写入组件库为新 Variant 资源；
4. **默认**将当前实例的引用切换为新变体（与 Unity 常见结果一致：场景物体变成新变体的实例）；
5. 支持在确认对话框中取消「切换引用」（仅入库，页面实例仍指原资源）——若实现分期，第一期可固定默认切换并写清文案。

### 图标（对齐 Figma 实心/空心 + Unity 变体区分）

| 对象 | 图标规则 |
|---|---|
| 主组件（库） | **实心** 组件符号（菱形或立方体，全产品统一一种） |
| 变体（库） | **空心** 同形，或实心 + **一侧条纹**（Unity 味，二选一写死） |
| 页面实例 | **空心** 组件符号（表示引用，非库本体） |
| 普通物料节点 | 现有 Container/Rectangle 等图标，**不用**组件符号 |

属性头 / 文档标签 MUST 用文案兜底：`主组件` / `变体 · 基于 {父名}` / `实例 · …`。

### 缺陷修复：实例覆盖必须能写回直接父源（含主组件）

对齐 Unity Apply to Prefab：

- 当实例**直接引用主组件（Base）**时，用户对本层覆盖执行 Apply（单项或全部）MUST 把操作
  落到 **Base 文档并保存**，再在同一产品流程中更新该实例的 `resolvedSnapshot` 与
  `instanceOverrides`（已消费的操作从本层移除）。
- 当实例**直接引用变体**时，Apply MUST 写入该**变体**资源（与现协议一致），不得静默失败。
- 根外观/尺寸等经 `instanceRoot` 通路的编辑 MUST 进入本层 `instanceOverrides`，使 Apply
  可见、可写回，而不是只改页面瞬时状态或空操作列表。
- 资源已保存但场景事务失败时 MUST 给出明确状态（禁止只显示「事务未提交」却无法重试或说明
  父源已变）；父源写入失败 MUST 向用户展示原因，且不得假装成功。
- 写回主组件后，其他引用同一主组件且无冲突覆盖的实例 MUST 能通过既有自动同步或检查更新
  看到结果（与 `planComposeInstanceAutoSync` 契约一致）。

### 明确非目标

- Detach / Unpack 成独立无引用节点（规范已非目标，本变更不引入）
- 跨 Provider 变体
- Figma 式 Component Set 状态表 Variants
- 复制/拖入默认建变体
- 更换变体的 base 父源（reparent variant）

## Impact

- 受影响规范：`component-library`、`basic-materials`、`editor-workspace-layout`、`scene-tree`
- 受影响代码：组件库面板拖放意图、Stage/editor 落点创建、场景树图标、实例创建变体对话框与改绑、
  属性头/变体文档 chrome 文案；**实例 Apply 回写**（`applyComposeInstanceOverrides` 接线、
  instanceRoot 编辑是否入 overrides、场景事务提交与错误提示）
- 前置：`update-component-instance-contract`、`unify-component-instance-surface`
- 破坏性：可能改变「创建变体后实例是否仍指向旧资源」的默认行为（若当前未改绑，本变更改为默认改绑）
