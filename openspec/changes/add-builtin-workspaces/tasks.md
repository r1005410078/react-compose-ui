## 0. 前置

- [x] 0.1 量 `app/symbols/` 里三个符号（断路器、隔离开关、PCS）的端口坐标模数，确认绘图的网格
      种子取 10 还是 8；结论写回 `proposal.md` 的取舍表

## 1. 定义与内建

- [x] 1.1 `ComposeEditorWorkspaceDefinition` 加 `palette`（title / search / sections）与 `seeds`
      （grid.stepX / stepY / snapEnabled）
- [x] 1.2 `drawing` 定义：builder（工具组标题「符号库」、活动、分栏拉高、底部折叠）、
      `session.crosshairSize = 100`、`seeds.grid = 10 / 10 + 吸附开`；`page` 补 `palette` 与 `seeds`
- [x] 1.3 切换时应用货架；另存为复制货架
- [x] 1.4 新建种子：在某个工作区里新建页面时 `document.canvas.grid` 取该工作区的 `seeds`

## 2. 物料面板货架

- [x] 2.1 `ComposeComponentDescriptor.folderPath`，由 Store 从资源条目的 `parentId` 链推出
- [x] 2.2 面板按 `sections` 渲染：`presets`（单项 include、折叠、`paletteHidden` 不可勾）、
      `folder`（按子文件夹分组 / 平铺、折叠）；标题与搜索框；文件夹不存在时那一段显示「找不到」
      并可去掉
- [x] 2.3 两个内建的默认货架：页面 = 基础组件 + `components` 平铺；绘图 = `Symbols` 按子文件夹
      分组 + `components` + 基础组件折叠，标题「符号库」，带搜索
- [x] 2.4 Vitest：`folderPath` 推导；按子文件夹分组；搜索跨段；找不到的文件夹不抛

## 3. 端到端

- [x] 3.1 切到绘图：工具组活动标签「符号库」、分栏更高、底部折叠、十字光标贯穿图面、事务日志
      没有新行
- [x] 3.2 `?symbols` 下面板按文件夹分组、搜索「终端」只剩一项；往文件夹导入新 SVG 后不改设置它
      就出现；文件夹被删后那一段显示「找不到」
- [x] 3.3 在绘图里新建页面，画布设置里步长读 10；在页面里新建读 8
- [x] 3.4 A 页在绘图、B 页在页面，A→B→A 之后左栏回到符号库
- [x] 3.5 两张工作区黄金图（页面 / 绘图）

## 4. 文档与验证

- [x] 4.1 `README.md` 补「页面 / 绘图」；`AGENTS.md` 当前阶段补「货架单位是来源不是物料」一条判据
- [x] 4.3 `AGENTS.md` 补两条：对齐吸附与特征点捕捉在绘图里不同时默认生效（含「只能是种子不能是
      会话开关」的理由）；两个内建的其余会话开关同值，因为会话开关本来就按工作区各记一份
- [ ] 4.2 `bun run lint`、`typecheck`、`test`、`build`、`test:e2e` 全绿
      —— 前四项全绿；`test:e2e` 每轮有 9–12 条**与本变更无关**的用例红，全部是同一个症状：
      `stage-surface` 刚 `toBeVisible()` 就 `boundingBox()` 读出 null。单独跑这些用例全绿。
      根因已定位：宿主换页面 `TransactionRuntime` 的那一帧，`useComposeEditorLayout` 按既有
      设计发布 `loading`（旧 Snapshot 配新文档会喂坏严格的 SceneIndex），`ComposeStage` 因此
      退成占位 div，`stage-surface` 消失约 5ms。这一闪在 `HEAD` 上同样存在（25 次里 5 次），
      但工作区 chrome 把它推到了用例开始交互之后。试过把宿主通知改成 layout effect：闪没了
      （20/20 单次挂载）、红的降到 2 条，但那 2 条是 component-library 与 instance-animation
      里稳定的新红，已回滚。修它要动启动次序，超出本变更范围，另开一个变更。
      —— 加上第 5 节之后重测：`257 passed, 1 failed`，红的那条正是同一个症状
      （`rectangle-curve.spec.ts`），单独跑绿。每轮红的条数在 1–12 之间浮动，集合每次都不同，
      与本变更无关这一判断不变。

## 5. 对齐吸附种子（本次修订新增）

- [x] 5.1 `ComposeWorkspaceSeeds` 加 `smartSnap: { nodes, guides }`；页面种子两项都 true、绘图
      两项都 false；`normalizeCustomWorkspace` 与「另存为」一并带上，缺席时回退到页面种子
- [x] 5.2 新建页面时把种子写进 `document.canvas.smartSnap`（与网格步长同一次落地，不额外发一条
      事务）
- [x] 5.3 删掉「两者的工具栏逐项相同」这条断言，换成断言两个工作区的 `session` 只在
      `crosshairSize` 上不同、`seeds` 在步长与 `smartSnap` 上不同；端到端那条判别性用例改断
      **命令可用性**（同一条命令两边都启动得了），且从命令行启动而不是点按钮——那颗按钮在不在
      货架上是另一回事
- [x] 5.4 Vitest：切换工作区不改已有文档的 `smartSnap`，且不产生事务（并入既有的种子端到端：
      切回页面工作区后那份文档读数一个字节不变）
- [x] 5.5 端到端：在绘图里新建页面，画布设置里对齐吸附是关的、网格吸附是开的；同一份文档切到
      页面再切回，`smartSnap` 一个字节不变
- [x] 5.6 两张工作区黄金图按需重录——**无变化**：对齐吸附不渲染任何东西，弹框也不在取景里，
      黄金图用例直接绿
