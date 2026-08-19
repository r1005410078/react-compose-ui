# 设计：场景模型与激活场景

## 决策 1：场景是 UI 名，Frame 是协议名

`Frame` 已经写进 `ComposeDocument v7`、`Component Asset v2`、命令表（`entity.frame.size.set`、
`frame.guide.*`）、Preview props 与大量测试 ID。为了一个界面用词再做一次全仓标识符改名，
收益远小于成本，也会让刚归档的 v7 规范立刻过时。

因此：**协议、命令、类型、testid、props 一律保持 `Frame`；只有用户可见文案是「场景 / Scene」。**
这层映射必须写进 AGENTS.md，否则后续实现者会在两个词之间反复横跳。

用户选择把页面文件字段改名为 `activeFrameId`（而不是 `activeSceneId`），正是这条决策的印证。

### 与既有「场景树 / 场景图」的关系

改名后场景树根层列出的正是各个场景，其下嵌套实体——与 Unity Hierarchy 同构，术语反而自洽。
两个面板名保持不变。

## 决策 2：Frame Component Definition 落在 materials

Entity Inspector 的分组来自 `registry.listComponents()` 返回的 Component Definition，
而 Component Definition 由 `@compose-ui/materials` 注册。当前 materials 里**没有任何 `Frame`
相关代码**（`presetId: 'frame'` 被 core 写入文档，却从未在 registry 注册），这正是当初必须
另造 `CanvasInspector` 的原因。

把 `Frame` Definition 加到 materials 是唯一符合架构边界的位置：materials 可以依赖 `core`，
`createComposeFrame`、`BUILTIN_COMMAND_TYPES.setFrameSize`、`frame.guide.*` 都在 core 的公共入口，
不需要反向依赖 editor。

**备选方案（否决）**：由 editor 通过 `EntityInspector.extraSections` 注入场景区块。
组件实例分支已经这么做了，所以机制现成。但那样 Frame 就永远不是"注册在册的 Component"，
组件文档工作区、未来的独立宿主都要各自重复注入——把领域知识留在 editor 里，正是当前缺口的成因。

## 决策 3：尺寸字段留在「基础」分组，提交改派

`entity.frame.size.set` 的 handler 同时写 `Frame.size` 与 LayoutItem 的固定尺寸回退，
这是刻意的：布局求解器只认 LayoutItem。一旦 Frame 走普通容器 Inspector，用户就会看到
两个「尺寸」——「基础」分组里的 LayoutItem 尺寸，和「场景」区块里的 `Frame.size`——
且从前者修改只写一半，两个值当场脱钩。

三个选项：

| 方案 | 结果 |
|---|---|
| A. 场景区块显示尺寸，隐藏 LayoutItem 尺寸 | 尺寸从用户熟悉的位置消失，且 LayoutItem 分组还有位置/外边距，只挖走尺寸很突兀 |
| B. 两处都显示，场景区块为准 | 两个数字并存，必然有人从错的那个改 |
| **C. 尺寸留在原位，提交改派 `setFrameSize`** | 用户看到唯一一个尺寸字段，写的是正确的命令 |

选 **C**。同时把 Frame 的尺寸模式锁定为 `fixed`——v7 校验本来就禁止 Frame 使用 Hug，
在 UI 上暴露一个提交必然被拒的选项没有意义。

「场景」区块因此只保留常见尺寸预设与辅助线，不再重复出现尺寸数字。

## 决策 4：激活是页面文件写入，不是文档事务

激活状态存在 `ComposePageFile.activeFrameId`，不在 `ComposeDocument` 里。事务运行时只
管理文档，因此激活切换**天然不进撤销历史**，与 `setPageSetupScript`、`setFrameAnimation`
属于同一类资源写入。

这不是妥协而是正确语义：激活场景是"这个页面对外发布哪一块"的项目配置，和"画布上摆了什么"
是两件事。用户撤销一次误删，不应该顺带把发布目标也撤回去。

**但这条必须测到、也必须让用户看得见**：
- e2e 显式断言 `Ctrl+Z` 不回滚激活切换。
- 激活切换会写页面文件，因此会推进 page revision；UI 必须与 `setPageSetupScript` 一样
  处理写入失败与 revision 冲突，不能静默吞掉。

反过来，**新建场景改的是文档**（往 `rootIds` 加一个 Frame Entity），是可撤销事务。
同一次用户操作若既建场景又切激活，这两半的撤销行为不同——所以新建场景**不自动激活**，
避免造出"撤销后场景没了但激活还指着它"的悬空状态。

## 决策 5：页面配置面板由 controller 无条件返回，页面数据靠注入

`controller.tsx` 拿不到页面会话（页面态住在 `compose-editor.tsx`），而现有的
`addDefaultElementProps` 已经在用 `cloneElement` 把 `pageScriptInspector` /
`animationInspector` 推给 controller 返回的任意 inspector 节点。

沿用这个机制：controller 在空选择时无条件返回 `<PageInspector/>`，页面相关的 props
由 compose-editor 克隆进去。**PageInspector 在没拿到页面 props 时必须回落成现在的空态文案**，
否则未启用页面系统的宿主会看到一个空壳面板。

多选仍走空态：多选时谈"页面配置"没有意义，而且会让"点空白工作区"这个唯一入口变得不确定。

## 决策 6：动画绑定锚定激活场景

当前动画绑定面板存在一处真实分歧：`reference` 取
`session.animationFrameId ?? page.defaultFrameId ?? rootIds[0]`，而 `animation` 镜像取
`resolveActiveFrameId(document, selectedIds)`。单场景下两者恰好相等，多场景下文件选择器
和时间线会指向不同的 Frame。

本变更统一锚定 `page.activeFrameId`。这也是"页面配置面板编辑激活场景的动画"这条产品决策
在实现上的落点。

## 决策 7：预览目标是场景选择器

预览对话框现在是 `'document' | 'container'` 二选一，且从不转发 `defaultFrameId`——
'document' 因此永远解析成 `rootIds[0]`，`page.defaultFrameId` 被完全忽略。

改为场景选择器（列出全部根 Frame，默认选中激活场景）后，"预览必须指定一个场景"这条语义
在 UI 上直接成立，两处 `rootIds[0]` 捷径一并消除。

## 待解决问题

无。
