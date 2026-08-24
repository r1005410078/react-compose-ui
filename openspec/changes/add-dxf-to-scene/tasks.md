# Tasks

## 1. 判别性用例先验红

- [x] 1.1 演示夹具加一个**基点落在自身几何包围盒之外**的块与一次旋转插入。基点在**盒外**时
      180 度已经完全可判别（盒被搬到基点另一侧），且包围盒是整数；非 90 度旋转的判别留给
      Vitest，那里可以断浮点
- [x] 1.2 新增 `e2e/dxf-import.spec.ts`：右键 `Topology.dxf` → 导入为页面，断言新页面被打开、
      场景里有曲线、那次旋转插入落在 DXF 说的位置上。**先跑确认红**——今天这一项产出的是
      `.cad.json`；实测把基点摘掉后读数由 30 变 100，差的正好是那个基点偏移

## 2. 新包 `@compose-ui/dxf`

- [x] 2.1 包骨架、构建、公共入口；依赖只有 `core`
- [x] 2.2 分词层与记录层原样搬入，`pairs` 仍是数组
- [x] 2.3 `planDxfImport(text, { createSeed, idFactory })`：注入 Preset seed，返回场景、
      组件资产与诊断
- [x] 2.4 Vitest：五种顶层图元、坐标翻转恒等式、`-0`

## 3. 块与实例

- [x] 3.1 BLOCK → Component Asset v2，根是 Frame，几何归一化到块包围盒
- [x] 3.2 INSERT → 组件实例；块基点写进 `Transform.pivot`，位置相应补偿
- [x] 3.3 非 1 缩放按 1 导入并报告；嵌套块沿用既有诊断
- [x] 3.4 Vitest：基点在盒外的旋转插入、基点即盒中心时与不写 `pivot` 等价、一块两插共用资产

## 4. 图层与文字

- [x] 4.1 图层四样各自求值：颜色进描边、`visible`/`locked` 进 Component、名字进 Entity 名
- [x] 4.2 文字盒 Hug，落点按 ascent / advance 两个比例估算；在实现处写明这是初值不是契约
- [x] 4.3 Vitest：关闭的图层、锁定的图层、未知图层落回 `0`、居中对齐的文字

## 5. 场景归一化

- [x] 5.1 场景尺寸取内容紧包围盒（钳到最小 1），几何整体平移到原点
- [x] 5.2 Vitest：远离原点的图

## 6. 编辑器接线

- [x] 6.1 `.dxf` 右键项换成「导入为页面」：写页面文件与全部组件文件，随后打开
- [x] 6.2 诊断提示保留主题与计数
- [x] 6.3 组件测试：目录不可写时该项禁用

## 7. 规范与文档

- [x] 7.1 `dxf-import` 规范增量
- [x] 7.2 AGENTS.md：新包的架构边界
- [x] 7.3 路线图：步骤 12a 回填实测，并记下 12b 的删除清单

## 7b. 实现时才浮现

- [x] 7b.1 `resolveSuggestedEntityInsertion` 直接信任宿主传来的 `activeFrameId`，而它住在页面
      文件上、与文档各自更新，切换页面标签时会有一帧对不上——读到 undefined 的 Entity 之后
      整块画布卸载。既有页面看不见这个坑：它们的 `activeFrameId` 要么是 null、要么恰好是每份
      空白文档都有的 `frame-root`
- [x] 7b.2 导入产出的文档在写盘前必检查：非法内容写下去之后用户看到的是一个打不开的页面，
      而问题出在几步之前

## 8. 五道门

- [x] 8.1 `bun run lint`
- [x] 8.2 `bun run typecheck`
- [x] 8.3 `bun run test`
- [x] 8.4 `bun run build`
- [x] 8.5 `bun run test:e2e`（147 passed，连跑两轮）
