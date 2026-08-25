# 任务

## 1. 先红

- [x] 1.1 `e2e/picking-preview.spec.ts`：`PLINE` 取三点后移动光标，预览折线有四个点
- [x] 1.2 同文件：`RECTANGLE` 取一个角点后移动光标，预览是闭合四边形
- [x] 1.3 同文件：上述两条同时没有橡皮筋元素
- [x] 1.4 同文件：`MOVE` 取基点后仍画橡皮筋（护栏）
- [x] 1.5 `e2e/finish-picking.spec.ts`：`PLINE` 取三点后右键得到三顶点多段线，且无上下文菜单
- [x] 1.6 同文件：命令不在跑时右键仍开菜单（护栏）
- [x] 1.6b 同文件：夹点点亮时右键不提交夹点（护栏）
- [x] 1.7 同文件：点工具栏按钮后焦点在命令行，直接 `Enter` 不重启命令
- [x] 1.8 跑 1.1–1.3、1.5、1.7，确认**都红**；1.4、1.6 确认绿

## 2. commands

- [x] 2.1 `ComposeCommandSession` 加可选 `preview?(point): TEffect | null`
- [x] 2.2 单元用例：不实现该方法的会话照常工作（既有宿主命令不受影响）

## 3. stage-engine

- [x] 3.1 `LINE` / `PLINE` / `RECTANGLE` / `CIRCLE` / `ARC` / `ARROW` / `WIRE` 实现 `preview`
- [x] 3.2 `MOVE` / `COPY` / `ERASE` / `VERTEX` 不实现（给不出几何）
- [x] 3.3 单元用例：`PLINE` 取两点后 `preview(p)` 返回三顶点；`RECTANGLE` 返回闭合四顶点
- [x] 3.4 单元用例：`preview` 不改会话状态（调用前后 `prompt` 与后续 `advance` 结果一致）
- [x] 3.5 `specifyNextPoint` 说明回车结束

## 4. stage

- [x] 4.1 每帧按解算后的落点调 `preview`，结果进覆盖层
- [x] 4.2 覆盖层渲染预览几何；有几何时不画橡皮筋
- [x] 4.3 根事件处理器：`awaitingPoint && gripTarget === null` 时右键推进 `accept` 并阻止上下文菜单
- [x] 4.4 `startCommand` 之后把焦点交给命令行输入框
- [x] 4.5 组件用例：右键在等待取点与不等待两种情形下走不同分支

## 5. 文案

- [x] 5.1 `specifyNextPoint` 中英各加一句「回车结束」

## 6. 文档

- [x] 6.1 `AGENTS.md`：预览几何由会话查询给出、与橡皮筋互斥；右键在取点中等于回车；焦点归属
- [x] 6.2 `docs/drafting-unification-roadmap.md` 记一条

## 7. 五道门

- [x] 7.1 `bun run lint`
- [x] 7.2 `bun run typecheck`
- [x] 7.3 `bun run test`（`editor` 的「页面 setup 资源流程 / 创建并解除 setup 引用」约每五次
      抖一次；`git stash` 到干净树上同样抖，与本刀无关，是既有 flake）
- [x] 7.4 `bun run build`
- [x] 7.5 `bun run test:e2e`

## 8. 观察项

- [x] 8.1 既有 e2e 零变红：断言橡皮筋的那几条都在夹点会话或 `MOVE` 上，两者都不给预览几何
- [x] 8.2 三条单元用例断言字面提示文本，改成引用 `messages`；`ARC` 那条改断 `specifyEndPoint`
- [x] 8.3 命令进行中右键：既有用例里没有
- [x] 8.4 `<polyline>` 会被 SVG 默认的黑色 `fill` 整块涂黑——橡皮筋是 `<line>` 围不出面积，
      因此这条从来没暴露过。用例里钉了 `fill` 的计算值，只数顶点数是数不出这个的
- [x] 8.5 渲染期读 ref 被 lint 挡下（挡得对）：改成 `useLayoutEffect` + 显式会话代次，
      用 layout effect 而不是 `useEffect` 是为了不比十字线慢一帧
