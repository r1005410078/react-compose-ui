# Tasks

## 1. 判别性用例先验红

- [ ] 1.1 `e2e/drafting.spec.ts` 加一条：打开**动画**开关 → 命令行键入 `LINE` → 取两点 →
      断言线画出来了且动画开关仍是开的。**先跑确认红**——`setDrafting(mode === 'drafting')`
      今天会在切到动画时把绘图关掉
- [ ] 1.2 这条是本刀唯一必然红的断言，也是「动画是另一根轴」这句判断的实证

## 2. 拆掉模式

- [ ] 2.1 `ComposeEditorMode` 去掉 `'drafting'`；切换器改两段（方向键保持按索引循环）
- [ ] 2.2 `compose-editor.tsx` 删掉 `drafting` state 与 `setDrafting(mode === 'drafting')`
- [ ] 2.3 `ComposeStageProps.drafting` 删除；`useStageDrafting` 的 `enabled` 恒真
- [ ] 2.4 `selectionMode` 与 `marqueeMode` 不再被模式改写：前者删掉 `'accumulate'` 那条分支，
      后者直接用宿主受控值
- [ ] 2.5 命令行常驻：`styles.css` 里 `--compose-stage-command-size` 不再由 `[data-drafting]`
      驱动，`data-drafting` 属性删除
- [ ] 2.6 十字光标改由「命令是否在等取点」决定，不再由 `drafting` 决定

## 3. 工具集收缩

- [ ] 3.1 `StageInteractionTool` 去掉 `'marquee'`、`'move'`、`'pan'`、`'draw-line'`
- [ ] 3.2 `pan` 插件条件收缩为「临时平移覆盖或中键」，优先级 1700 不变
- [ ] 3.3 `marquee-tool`（1100）与 `move-axis`（900）两条插件退场；同步更新
      `gesture-priority.ts` 的优先级表，那张表是给人读的，漏改会让下一个人对不上
- [ ] 3.4 用例：中键仍能平移；`select` 空白拖拽仍能框选（**在非 100% 缩放下断言**）

## 4. 工具栏

- [ ] 4.1 去掉框选、精确移动、移动画布三个按钮与 `draw-line` 菜单项
- [ ] 4.2 判定模式 chevron 改挂 `select` 按钮，split button 的 ARIA 与键盘结构照搬
- [ ] 4.3 主按钮图标改为反映**当前工具**；当前判定由菜单项选中态表达
- [ ] 4.4 删除 `stage.marqueeTool` / `stage.moveTool` / `stage.panTool` /
      `stage.drawLineTool` 四个动作、快捷键与两份 i18n 文案
- [ ] 4.5 确认自定义快捷键指向已删动作时按既有的未知动作处理（忽略该条，不影响其余），
      若没有这条兜底则补上——否则用户的偏好文件会整份加载失败

## 5. 回归

- [ ] 5.1 点选两个对象只剩后一个（替换语义）；Shift 点击累加
- [ ] 5.2 `ERASE` 用 Shift 多选后能删一批，只占一步撤销
- [ ] 5.3 既有 `e2e/drafting.spec.ts` / `drafting-chrome.spec.ts` 里所有「先切绘图模式」的
      前置步骤删掉后仍全绿——这是「能力没有随模式一起丢」的证据
- [ ] 5.4 `e2e/editor-workspace.spec.ts` 等断言三段切换器的用例改两段

## 6. 收口

- [ ] 6.1 `bun run lint`
- [ ] 6.2 `bun run typecheck`
- [ ] 6.3 `bun run test`
- [ ] 6.4 `bun run build`
- [ ] 6.5 `bun run test:e2e`
- [ ] 6.6 `bunx openspec validate remove-drafting-mode --strict`
- [ ] 6.7 `AGENTS.md` 删掉「绘图是 Stage 的第三种模式」整段，改写为「绘图能力恒开」，
      并同步选择语义只剩一套这条
- [ ] 6.8 路线图步骤 6 标记已交付；把「拖与取点二合一」与「十字光标两条偏好」两项分别记到
      后续步骤，并写明推迟理由（前者是仲裁问题，后者会在步骤 9 重做一遍）
