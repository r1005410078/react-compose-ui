# Tasks

## 1. 判别性用例先验红

- [x] 1.1 `e2e/drafting.spec.ts` 加一条：画布上放一个对象 → 命令行键入 `UNDO` → 断言那一步被
      撤销。**先跑确认红**——今天 `UNDO` 不在注册表里，命令行只会回「未知命令」
- [x] 1.2 同一文件再加一条：不选中任何对象键入 `GROUP` → 断言命令行显示的是**不可用原因**，
      既不是「未知命令」也不是静默。这条验证「三种拒绝互相可分」
- [x] 1.3 两条都必须在**非 100% 缩放**下取画布坐标（`?no-auto-fit` + 显式等 surface 可见），
      与既有绘图用例同一条约定

## 2. `commands`：描述符与退化会话

- [x] 2.1 抽出 `ComposeCommandDescriptor`；`ComposeCommandDefinition extends` 它。`shortcut`
      用本包已有的 `ComposeKeybinding`，不引入新依赖
- [x] 2.2 `createComposeImmediateCommand({ ...descriptor, run })` → 定义，会话 `prompt` 为
      `null`，`accept` 时执行 `run()` 并返回 `{ status: 'commit', effect }`
- [x] 2.3 `runComposeCommandImmediately(definition, context)`：启动 → `prompt` 为 `null` 就
      `accept`，否则返回「需要进一步输入」且**不推进**
- [x] 2.4 单测：退化命令一次确认即提交；对多步命令调用立即入口不推进会话
- [x] 2.5 公共入口导出四个新名字，`@packageDocumentation` 补一句描述符的存在理由

## 3. `stage-engine` / `stage`：一份注册表

- [x] 3.1 `StageDraftingMessages` 加两条分组文案（绘图 / 编辑）；
      `createStageDraftingCommands` 给八条内建命令填 `category`
- [x] 3.2 `ComposeStageProps` 新增 `commands?: readonly ComposeCommandDefinition<
      StageDraftingContext, StageDraftingEffect>[]`，TSDoc 写明「注入定义，不注入会话」
- [x] 3.3 `useStageDrafting` 把注入的定义与内建的合并后建注册表。**顺序：内建在前**，重名由
      `createComposeCommandRegistry` 抛错——不兜底，理由见 design 第 9 节。
      注册表**在提交那一刻才建**而不是挂 `useMemo`：注入的定义引用不可能稳定，挂上去会让
      身份变化传染到 `submit` 与整个会话对象，症状是端到端间歇失败（design 第 11 节）
- [x] 3.4 `submit()` 解析到定义后先看 `disabledReason`：非空则 `setNotice(reason)` 并 return，
      不 `start()`
- [x] 3.5 `submit()` 里那段「`prompt` 为 null 就立即 accept」改为调用
      `runComposeCommandImmediately`，删掉内联分支
- [x] 3.6 组件测试：注入一条退化命令 → 键入它 → `run` 被调用一次；注入一条带
      `disabledReason` 的 → 键入它 → 提示是那条原因且 `run` 未被调用

## 4. 命令历史

- [x] 4.1 `ComposeCommandLine` 内部保留已提交的非空文本行（上限 50，超出丢最早的）；
      ArrowUp/ArrowDown 召回并 `preventDefault`。到达最新一条之后再按下方向键回到空输入
- [x] 4.2 组件测试：提交三行 → 上箭头三次依次召回 → 下箭头回到更近的行 → 再下一次回到空
- [x] 4.3 `useStageDrafting` 加 `lastCommandRef`：只在**定义成功解析并启动**时写入；
      `submit('')` 且无会话时按它重启。取消过的命令仍可重复
- [x] 4.4 用例：`LINE` 画完 → 空 Enter → 命令行回到「指定第一点」。键入坐标那一行**不会**
      被当成命令重启

## 5. `editor`：目录产出定义

- [x] 5.1 `action-catalog.ts` 新增 `createComposeEditorCommands(context)`：在既有 handlers 之上
      用 `createComposeImmediateCommand` 包装，`title` / `category` / `disabledReason` 复用
      `createComposeEditorActions` 那一步的本地化结果
- [x] 5.2 `createComposeEditorActions` 改为从同一份目录派生描述符 + `run`，两个函数**不得**各自
      再算一遍可用性
- [x] 5.3 别名表：`UNDO`(`U`) / `REDO` / `COPYCLIP` / `CUTCLIP` / `PASTECLIP` / `DUPLICATE` /
      `GROUP` / `UNGROUP` / `BRINGFORWARD` / `SENDBACKWARD` / `BRINGTOFRONT` / `SENDTOBACK` /
      `COMPONENT` / `SCENE` / `ZOOMIN` / `ZOOMOUT` / `ZOOMRESET` / `FITSELECTION` /
      `FITCONTAINER` / `GRIDSNAP` / `SMARTSNAP` / `SETTINGS`
- [x] 5.4 **八个工具切换与 `edit.delete` 不给别名**（design 第 8 节）；单测断言这九条的
      `aliases` 为空，防止后来者顺手补上
- [x] 5.5 单测：别名与内建八条命令的 id/别名**无交集**（这条挡的是注册表抛错）
- [x] 5.6 `ComposeEditor` 把目录的定义传给 `<ComposeStage commands=…>`；面板继续拿描述符列表。
      控制器新增 `actionContext`（执行层，与语言无关），本地化在 `ComposeEditor` 内补齐——
      与命令面板的装配位置同一条既有理由。**按可选消费**：`ComposeEditorController` 是宿主
      可以手写的接口，既有测试用 `as unknown as` 只实现关心的那几项

## 6. `command-panel`

- [x] 6.1 `ComposeCommandAction` 改为 `ComposeCommandDescriptor & { run(): void }`，新增
      `@compose-ui/commands` 依赖（零运行时依赖，允许）
- [x] 6.2 `command-filter.ts` 把 `aliases` 纳入匹配；单测搜 `UNDO` 命中「撤销」
- [x] 6.3 Story 与既有测试按新类型调整，行为不变（新字段全部可选，实际零改动）

## 7. 回归

- [x] 7.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 7.2 `bun run test:e2e`：命令行常驻改的画布几何在步骤 6 已经落定，本刀不应再动黄金图；
      若有变化必须逐张确认原因
- [x] 7.3 CAD 命令行不受影响（它没有注入宿主命令）：跑一遍 `e2e/cad*.spec.ts`

## 8. 文档

- [x] 8.1 AGENTS.md：`commands` 那段补「描述符是两个入口共用的呈现半边」与「别名不本地化」
- [x] 8.2 `docs/drafting-unification-roadmap.md`：步骤 7 移入已交付，记下别名表暴露的两处重复
