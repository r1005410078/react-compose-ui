# Tasks

## 1. 判别性用例先验红

- [x] 1.1 `e2e/drafting.spec.ts` 加一条：打开**动画**开关 → 命令行键入 `LINE` → 取两点 →
      断言线画出来了且动画开关仍是开的。**先跑确认红**——`setDrafting(mode === 'drafting')`
      今天会在切到动画时把绘图关掉
- [x] 1.2 这条是本刀唯一必然红的断言，也是「动画是另一根轴」这句判断的实证

## 2. 拆掉模式

- [x] 2.1 `ComposeEditorMode` 去掉 `'drafting'`；切换器改两段（方向键保持按索引循环）
- [x] 2.2 `compose-editor.tsx` 删掉 `drafting` state 与 `setDrafting(mode === 'drafting')`
- [x] 2.3 `ComposeStageProps.drafting` 删除；`useStageDrafting` 的 `enabled` 恒真
- [x] 2.4 `selectionMode` 与 `marqueeMode` 不再被模式改写：前者删掉 `'accumulate'` 那条分支，
      后者直接用宿主受控值
- [x] 2.5 命令行常驻：`styles.css` 里 `--compose-stage-command-size` 不再由 `[data-drafting]`
      驱动，`data-drafting` 属性删除
- [x] 2.6 十字光标改由「命令是否在等取点」决定，不再由 `drafting` 决定

## 3. 工具集收缩

- [x] 3.1 `StageInteractionTool` 去掉 `'marquee'`、`'move'`、`'pan'`、`'draw-line'`
- [x] 3.2 `pan` 插件条件收缩为「临时平移覆盖或中键」，优先级 1700 不变
- [x] 3.3 `marquee-tool`（1100）与 `move-axis`（900）两条插件退场；同步更新
      `gesture-priority.ts` 的优先级表，那张表是给人读的，漏改会让下一个人对不上
- [x] 3.4 用例：中键仍能平移；`select` 空白拖拽仍能框选（**在非 100% 缩放下断言**）

## 4. 工具栏

- [x] 4.1 去掉框选、精确移动、移动画布三个按钮与 `draw-line` 菜单项
- [x] 4.2 判定模式 chevron 改挂 `select` 按钮，split button 的 ARIA 与键盘结构照搬
- [x] 4.3 主按钮图标改为反映**当前工具**；当前判定由菜单项选中态表达
- [x] 4.4 删除 `stage.marqueeTool` / `stage.moveTool` / `stage.panTool` /
      `stage.drawLineTool` 四个动作、快捷键与两份 i18n 文案
- [x] 4.5 偏好里那四条动作随类型一起删除，`COMPOSE_EDITOR_SHORTCUT_SCOPES` 与默认键位表
      同步收缩；类型收窄后编译期就挡住了引用，不需要运行期兜底

## 5. 回归

- [x] 5.1 点选两个对象只剩后一个（替换语义）；Shift 点击累加
- [x] 5.2 `ERASE` 用 Shift 多选后能删一批，只占一步撤销
- [x] 5.3 既有 `drafting.spec.ts` / `drafting-chrome.spec.ts` / `curve-vocabulary.spec.ts` /
      `rotation-pivot.spec.ts` 里所有「先切绘图模式」的前置步骤删掉后仍全绿——这是「能力
      没有随模式一起丢」的证据。
      **顺带发现那一步曾充当隐式等待**：删掉之后几条用例开始间歇性拿到 `boundingBox() === null`，
      每次失败的还不是同一条。补上显式的 `toBeVisible()` 之后连续两轮全绿
- [x] 5.4 `e2e/editor-workspace.spec.ts` 等断言三段切换器的用例改两段

## 6. 收口

- [x] 6.1 `bun run lint`
- [x] 6.2 `bun run typecheck`
- [x] 6.3 `bun run test`
- [x] 6.4 `bun run build`
- [x] 6.5 `bun run test:e2e`
- [x] 6.6 `bunx openspec validate remove-drafting-mode --strict`
- [x] 6.7 `AGENTS.md` 删掉「绘图是 Stage 的第三种模式」整段，改写为「绘图能力恒开」，
      并同步选择语义只剩一套这条
- [x] 6.8 路线图步骤 6 标记已交付；两项推迟连同理由一并记入
- [x] 6.9 **提案没预见的两处**，已落进实现与路线图：
      ① Esc 的归属——绘图恒开后它原来那条「没有命令也吃 Esc」会抢在文字编辑的退出分支之前，
      用户改完字按 Esc 会变成清空选择集；那条本就是累加语义的配套，语义统一后自动失效；
      ② 命令行常驻让画布恒定少 30px，十二张黄金图与几条写死画布偏移量的用例一起变——
      黄金图按预期更新，两条用例改成不依赖固定偏移（取盒交集 / 改用 Inspector 编辑）
