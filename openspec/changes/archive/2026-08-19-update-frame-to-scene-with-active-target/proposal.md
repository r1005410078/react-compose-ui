# 变更：场景模型——画板成为真容器，并引入激活场景

## 原因

v7 把隐式 Canvas 根收敛成了 Frame，但只走完一半，留下四个互相牵连的缺口：

1. **Frame 不是真容器。** 选中它打开的是专用面板「画布属性」（尺寸 + 背景 + 页面脚本 + 动画），
   圆角、边框、透明度、Auto Layout、容器溢出全都编辑不了。后果已经出现：组件文档的根是 Frame，
   用户能在实例上改圆角并 Apply 写回主组件，却无法在组件文档里看到或编辑同一个属性。
2. **多画板不可达。** `rootIds` 协议上接受多个 Frame，产品里却没有任何新建入口——
   `受约束的 Frame 升格入口` 列的四个隐含升格动作只实现了「从选择创建项目组件」一个。
3. **「默认 Frame」空转。** `ComposePageFile.defaultFrameId` 已定义、已校验、已序列化，
   `page-store.setPageDefaultFrame` 也已实现，但没有任何生产调用方；Preview 对话框与 Stage
   都绕开它直接取 `rootIds[0]`。用户无从知道也无从指定"发布出去的是哪一块"。
4. **空白工作区点击无处可去。** 点空白只是清空选择，落到不接受任何 props 的空态组件，
   注入的页面脚本与动画区块被静默丢弃——于是这两样东西只有选中 Frame 时才够得着。

本变更把四个缺口一次补齐，并给用户概念定名：无限工作区上摆着多个**场景**，其中恰好一个是
**激活场景**——与 Unity 多场景编辑的 Active Scene 同构。

## 变更内容

- **场景即 Frame 的用户名。** 协议与代码标识符保持 `Frame` 不变，只有用户可见文案改为
  「场景 / Scene」。这层映射必须在 AGENTS.md 中写明，避免后续实现者混淆。
- **Frame 成为真容器。** 新增 `Frame` Component Definition 与 Inspector；选中 Frame 打开
  普通容器 Entity Inspector（身份、几何、外观、Auto Layout、容器溢出）加一个「场景」区块
  （常见尺寸预设与辅助线）。原 `CanvasInspector` 不再承担 Frame Inspector 角色。
- **尺寸只有一个事实来源。** Frame 的尺寸字段仍显示在「基础」几何分组，但提交改派
  `entity.frame.size.set`，且尺寸模式锁定为 `fixed`。用户看不到两个「尺寸」，也不会写出
  只更新 LayoutItem、与 `Frame.size` 脱钩的半份状态。
- **BREAKING** `ComposePageFile` 升到 3：`defaultFrameId` 改名为 `activeFrameId`，语义由
  「仅回退目标」升为「激活目标」。提供 PageFile 2→3 的显式单向迁移，无静默兼容。
- **新增页面配置面板。** 空选择时右侧显示页面属性：激活场景选择器、页面脚本、动画。
  **不含页面尺寸**——尺寸属于场景，不属于页面。页面脚本与动画区块从 Frame Inspector 迁入。
- **新增场景动作。** `新建场景`（可撤销文档事务，隐含加 `Frame` Component）与
  `设为激活场景`（页面文件写入，**不进撤销历史**）。后者有三个入口：场景标签上的标记、
  场景右键菜单、页面配置面板的下拉。
- **场景标签承载激活语义。** 激活场景的标题标签在名称前显示播放按钮（以该场景为目标打开
  预览），名称后显示「激活」标记；非激活场景显示可点击的未激活标记。
- **预览目标默认解析为激活场景。** 预览对话框的「文档 / 选中画板」二选一改为场景选择器。
- 清理三处 inert 死代码：`output` 命中类型（零生产者）、`output.select` 效果与
  `onOutputSelect` prop（无宿主接线）、被丢弃的 `InspectionTarget` 状态。

## 非目标

- 不改变 `Frame`、`Animations`、`Animation` 的文档协议——动画仍归属 Frame。
- 不改变 `ComposeDocument` 版本，仍是 v7。
- 不提供裸露的「升格为 Frame」命令；升格仍只作为具名用户动作的隐含结果。
- 不实现 detach（归档变更的任务 3.4 仍然遗留）。
- 不改 Preview 的 `defaultFrameId` **prop** 名——它的语义确实是「省略 `frameId` 时的回退」，
  与页面文件字段不是同一件事。

## 影响

- 受影响的规范：`compose-document`、`pages`、`editor-workspace-layout`、`stage`、
  `compose-preview`、`scene-animation`、`command-transaction`、`stage-engine`
- 受影响的代码：`packages/core`（PageFile 3、迁移器、issue code）、
  `packages/pages`（`setPageActiveFrame`）、
  `packages/materials`（`Frame` Component Definition/Inspector、几何尺寸改派）、
  `packages/editor`（Inspector 路由、页面配置面板、场景动作、动画绑定锚点）、
  `packages/stage`（场景标签、激活边界样式、死代码清理）、
  `packages/stage-engine`（死代码清理）、
  `packages/preview`（场景选择器、回退转发）、`app/`、`e2e/`
- 顺带修复：组件文档根 Frame 无法编辑外观；动画绑定面板的 `reference` 与 `animation`
  用两套 frame 解析导致多场景下互相矛盾；预览对话框从不转发 `defaultFrameId`。
