## 1. 几何与命名（core）

- [x] 1.1 红：`curve.test.ts` 新增「接线点的几何」三条（是填满盒的闭合方块 / 仍算闭合 /
      边长由线宽推出）。红：`expected { kind: 'arc', …} to deeply equal { kind: 'polyline', …}`；
      「仍算闭合」一开始就绿，它钉的正是本次**不变**的那一条
- [x] 1.2 绿：`composeJunctionGeometry` 产出 `{ kind: 'polyline', vertices: 盒的四角, closed: true }`；
      它与 `composeJunctionSize` 的 TSDoc 里「内切的整圆」「而接头是圆的」两处已重写
- [x] 1.3 `COMPOSE_JUNCTION_DIAMETER_RATIO` 改名 `COMPOSE_JUNCTION_SIZE_RATIO`，同步
      `packages/core/src/index.ts` 与全部引用；**未留转发别名**（见 design 决策三）

## 2. Preset（materials）

- [x] 2.1 `curve.test.tsx` 的「是填实的整圆」改成「是填实的方块」，断四个顶点就是盒的四角；
      「直径跟着线宽走」改名「边长跟着线宽走」。**这一组没有独立的红**——几何由 core 的 helper
      带过来，1.1 那次红就是它的红
- [x] 2.2 绿：本包无需改几何；图标从 `ComposeCircleMaterialIcon` 换成 `ComposeRectMaterialIcon`，
      Preset 注释里两处「整圆 / 实心点」跟着改
- [x] 2.3 「与导线共用同一个 Renderer」「默认不出现在 Palette」两条原样绿——换形状没碰到它们

## 3. 端到端

- [x] 3.1 四处定位选择子从 `circle[…]` 换成 `polygon[…]`，并改掉三处讲「渲染成 `<circle>`」的注释
- [x] 3.2 **换选择子暴露了一处只有跑了才看得见的问题**：`junction-fixed-size.spec.ts` 的对照组
      本来是一个矩形，而矩形也是闭合多段线、同样渲染成 `<polygon>`——画下去之后那个 `junction`
      定位子就指向两个元素。对照改取**整圆**（走 `<circle>`，两不相干）
- [x] 3.3 第二处：对照的落点原先按 `圆心 ± 半径` 硬算，落空了——半径点被网格吸附，画出来的半径
      与键入的差三个像素，已经超过命中容差。改成取**量出来的**包围盒左边中点
- [x] 3.4 全量 `bun run test:e2e` 绿（315 条）。`junction-fixed-size` 的「选中没有缩放手柄」仍绿——
      它靠的是「闭合曲线选中时画盒」，而闭合性正是本次不变的那一条

## 4. 规范

- [x] 4.1 `basic-materials` 的「junction Preset 是接线节点」：几何改成「四顶点的闭合多段线，即
      填满盒的方块」；身份判据那句换成方块的说法（判据本身不变），并补一条推论——**MUST NOT 按
      渲染出来的元素标签认接线点**，那是几何的派生物
- [x] 4.2 「默认直径」→「默认边长」；`rotatable: false` 的理由**已重写**——「一个圆转了等于没转」
      对方块不成立，新的理由是形状与尺寸同源（都不是作者写下的），而转过 45° 的接线点读作菱形，
      那是另一个符号
- [x] 4.3 场景「节点是填实的整圆并带一个端口」→「节点是填实的方块并带一个端口」，断言改成四顶点；
      「直径跟着线宽」→「边长跟着线宽」
- [x] 4.4 「端口 MUST 恒在盒心」那一段里「圆点的视觉中心」→「方块的视觉中心」；提案与要求里都写下
      了代价：方块与 `vertex` 夹点同形，圆则与端口记号同形，没有一种形状是白拿的

## 5. 验证

- [x] 5.1 `bun run lint` / `bun run typecheck` / `bun run test`（55/55）/ `bun run build` 全绿
- [x] 5.2 `openspec validate update-junction-square --strict` 通过
- [x] 5.3 既有文档里的圆点**不做迁移**——判据是「线上有没有资产」，而接线点是这几天才落地的。
      **这一条还没有被确认**：若已有存过的接线图，同一张图上会出现两种形状的接线点，需要补一次
      性重写
