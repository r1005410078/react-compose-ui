# 任务

> 依赖：`add-animation-asset-and-mode-switcher` 已实现但未归档，本变更直接在其代码之上继续；
> 两者在本变更完成后一并归档（先它、后本变更）。

## 1. Core 协议与迁移

- [x] 1.1 `@compose-ui/core` 新增 `Frame` Component：schema（正有限 size）、解析器、
      「Frame 依赖 Hierarchy」组合约束、Frame 上 Hug 拒绝规则；补 Vitest。
- [x] 1.2 新增 `Animations` Component：清单 schema（id/名称/durationMs/播放模式/bindings）、
      「Animations 依赖 Frame」组合约束；删除 `ComposeDocument.animations` 字段。
- [x] 1.3 rootIds 拓扑约束改为「至少一个且全部为 Frame」；删除隐式 Canvas 根概念与
      `document.output` 全部类型、默认值与校验；`createDefaultOutputSettings` 删除。
- [x] 1.4 `canvas.guides` 从 `CanvasSettings` 移除，辅助线 schema 迁入 Frame；
      `createDefaultCanvasSettings` 不再产出 guides。
- [x] 1.5 新增 `createFramePreset` 级别的文档构造助手与 `resolveOwningFrame(document, entityId)`
      纯函数（供 animation/stage/editor 共用）。
- [x] 1.6 v6→v7 迁移器 `migrateComposeDocumentV6ToV7`：包根 Frame、搬 output/animations/guides、
      保持 id 与子级顺序；普通解析对 v6 返回稳定 legacy issue。补 golden fixture（含多根、
      有/无动画、有/无 guides 四种）。
- [x] 1.7 `ComposePageFile` 升到 `pageSchemaVersion: 2`：新增 `defaultFrameId`、删除页面级
      `animation`；`migrateComposePageFileV1ToV2`；补容缺与迁移测试。

## 2. 动画领域

- [x] 2.1 `@compose-ui/animation` 清单读写改到 Frame 的 `Animations`；删除文档级清单入口。
- [x] 2.2 校验新增跨 Frame 轨道 issue 与孤立分组 issue（按所属 Frame 判定）；采样器对非法
      轨道静默跳过；补测试。
- [x] 2.3 命令 handler 在写入前拒绝指向嵌套 Frame 内部的轨道命令，返回稳定 issue。
- [x] 2.4 动画文件（`.animation.json`）绑定引用从页面级移到 Frame；水合与回写按 Frame 进行。
- [x] 2.5 嵌套 Frame 播放控制协议（play/pause/seek/mode），不暴露内部属性采样。
- [x] 2.6 跨 Frame 轨道重定位命令：搬迁子树轨道、逐字段保留关键帧、目标缺动画时按源清单新建、
      同名冲突要求显式分组 id、可与结构命令组成单事务并共享撤销；补 Vitest（新建/冲突/撤销）。

## 3. 组件资产与模板

- [x] 3.1 `Component Asset` 升到 `schemaVersion: 2`：Base 单根必须带 `Frame`；Parser 拒绝
      多根与非 Frame 根。
- [x] 3.2 `migrateComponentAssetV1ToV2`：已是 Frame 则原地通过，否则包一层 Frame（size 取原根
      `Transform.size`）；普通解析对 v1 返回 legacy issue。
- [x] 3.3 Resolver 校验：拒绝移除根 `Frame` 或产生多根的 Variant 操作。
- [ ] 3.4 detach 实现/对齐：展开为普通子树且根保留 `Frame`，可撤销；补测试。

## 4. 渲染与嵌套统一

- [x] 4.1 `@compose-ui/materials`：Frame Renderer（背景 + 裁剪 + 局部原点），组件实例与
      Page Slot 收敛到同一套 Frame 引用嵌套实现（渲染、寻址、循环/深度阻断）。
- [x] 4.2 `@compose-ui/layout-engine`：每个 Frame 一个独立求解 Runtime；补嵌套深度基准测试，
      超阈值时惰性求解仅可见 Frame。
- [x] 4.3 `@compose-ui/preview`：删除 document/frame 双路径，统一单 Frame target；新增
      `fit`/`alignment` props；嵌套 Frame 各自播放；补测试并删除旧路径测试。

## 5. Stage

- [x] 5.1 多 Frame 边界渲染、选中语义（Frame 进入 selectedIds 与 SceneTree）；删除 output
      inspection 会话目标与相关回调。
- [x] 5.2 原点十字标记锚定活动 Frame 局部原点，标尺刻度改读活动 Frame 局部坐标。
- [x] 5.3 辅助线改为活动 Frame 局部坐标，切换活动 Frame 只显示该 Frame 的 guides。
- [x] 5.4 跨 Frame 拖拽：offset 坐标转换保持屏幕位置；携带轨道时在同一事务调用 2.6 重定位命令；
      同名冲突时提交前弹出「合并到哪条动画 / 新建动画」选择，取消不产生事务；补 e2e。

## 6. Editor

- [x] 6.1 `canvas-inspector.tsx` → `frame-inspector.tsx`：尺寸 Map、背景 Color、页面脚本、
      动画绑定，全部作用于选中 Frame Entity 事务；删除 `output.configure` 命令与相关 i18n。
- [x] 6.2 动画模式作用域改为活动 Frame；组件工作区开放动画模式入口；切换 Frame 更新时间线。
- [ ] 6.3 受约束升格入口：四个动作隐含加 `Frame`（同一事务），移除任何裸升格菜单项；
      UI 说明作用域边界；补组件测试。
- [x] 6.4 页面工作区：`defaultFrameId` 读写、保存时保留绑定、悬空 id 报错不静默改写。
- [x] 6.5 Frame 动作目标解析：适配画布/缩放到 Frame 等以当前选中 Frame 为目标，非 Frame 选择
      解析最近祖先 Frame，无选择回退 `defaultFrameId`；补测试。
- [x] 6.6 `@compose-ui/scene-tree`：根层列出 Frame，Frame 图标与普通 Container 区分。

> 状态：协议层、动画、组件资产、渲染嵌套、Stage、Editor、示例夹具与文档已完成，全仓
> lint/typecheck/test/build/e2e（79/79）通过。剩余：3.4 detach 与 6.3 受约束升格入口
> 尚未实现，另需单开一条变更补 Frame Inspector 的外观字段（圆角/边框/透明度）——
> 组件文档的根现在是 Frame，选中它无法编辑这些属性。

## 7. 迁移与验证

- [x] 7.1 `app/` 示例文档与全部测试夹具迁到 v7 / Component v2 / PageFile 2。
- [x] 7.2 更新 `README.md`（当前文档协议描述）与 `AGENTS.md`（v6 → v7、Frame 边界、
      各包职责措辞）。
- [x] 7.3 `bun run lint && bun run typecheck && bun run test && bun run build`。
- [x] 7.4 `bun run test:e2e`（多画板、跨 Frame 拖拽、组件动画、Frame Inspector 黄金图）。
- [x] 7.5 `openspec validate update-root-canvas-to-frame-model --strict`。
- [x] 7.6 归档：先 `openspec archive add-animation-asset-and-mode-switcher --yes`，
      再 `openspec archive update-root-canvas-to-frame-model --yes`，最后
      `openspec validate --strict` 确认 `specs/` 反映 Frame 级绑定。
