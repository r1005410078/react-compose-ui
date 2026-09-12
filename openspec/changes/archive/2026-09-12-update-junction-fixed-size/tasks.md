## 1. 接线点声明几何约束（materials）

- [x] 1.1 红：`curve.test.tsx` 的 `junction Preset` 补「改不了尺寸也转不了，但照旧能挪」与
      「其余四个曲线起点照旧自由」两条。红：`expected undefined to deeply equal
      { movable: true, resize: 'none', … }`；第二条从一开始就绿，它挡的是「把所有曲线一起锁上」
- [x] 1.2 绿：`junction` 的 `extra.components` 里补
      `GeometryConstraints: { movable: true, resize: 'none', rotatable: false }`。
      不改 `curvePreset` 的签名——那个回调本来就是为节点的端口开的，多一个 Component 用同一条路
- [x] 1.3 更新 `createCurveMaterial` 的 TSDoc：节点是「曲线关掉 resize」那条决定的**唯一例外**，
      而理由完全不同（尺寸由线宽推出、改它会静默弄坏绑定的落点），不是「还没想清楚」

## 2. 命令层的漏洞（core）

- [x] 2.1 红：`curve.test.ts` 的 `entity.curve.set 漏斗` 补「尺寸锁死时拒绝」与「不带约束的曲线
      照旧写得进」。红：`expected 'committed' to be 'rejected'`
- [x] 2.2 绿：`setCurveHandler` 在 `entity.locked` 那一支之后加
      `resolveComposeGeometryConstraints(entity).resize === 'none'`，以 `curve.constraint` 拒绝。
      **无条件拒绝而不是「盒变了才拒绝」**——这条命令的盒是几何的派生量，写几何就是写盒
- [x] 2.3 `entity.transform.set` 那条既有拒绝（`transform.constraint`）一个字节未动；本条是补它的
      漏，不是换它

## 3. 几何编辑会话的准入（stage）

- [x] 3.1 红：新增 `geometry-editing/geometry-editable.test.ts` 四条（none 挡住 / 不带约束照旧 /
      其余档位不受影响 / 锁定与无 Curve 照旧）。把谓词最后一行换成 `return true` 后确认红：
      `expected true to be false`，其余三条仍绿
- [x] 3.2 绿：谓词抽成纯函数 `isComposeEntityGeometryEditable`（住
      `geometry-editing/geometry-editable.ts`），多一条
      `resolveComposeGeometryConstraints(entity).resize !== 'none'`。**读文档上的约束而不是
      presetId**
- [x] 3.3 `VERTEX` 走的是同一个谓词（`vertex-command.ts` 按 `context.isGeometryEditable` 过滤，
      而 `compose-stage.tsx` 传的就是这一个），因此它自动以 `rejected` 说明
- [x] 3.4 画布上的八个手柄**不需要改**：`resolveStageResizeHandles` 早就按
      `GeometryConstraints.resize` 求手柄集合，`none` 时为空。这是「走约束而不是按 presetId 挡」
      这个决定第一处直接兑现

## 4. 属性面板按约束只读（materials）

- [x] 4.1 红：`component-inspectors.test.tsx` 补三条（尺寸锁死时宽高只读 + 旋转只读 + 位置仍可改 /
      `movable: false` 时位置只读 / 不带约束时都可改）。红两条，第三条从一开始就绿
- [x] 4.2 绿：`createLayoutItemInspector` 读 `resolveComposeGeometryConstraints`——`size` 复用既有的
      `sizeReadOnly` 上下文标记（与格中子级同一格），`rotation` 与 `position` 走
      `v.metadata({ propertyPanel: { readOnly: true } })`。两条都是既有的 `readOnly` 通道，
      没有为约束另造呈现
- [x] 4.3 判别性用例同时断「接线点只读」与「不带约束的 Entity 照旧可改」

## 5. 端到端

- [x] 5.1 红：新增 `e2e/junction-fixed-size.spec.ts`。去掉 Preset 上那行约束后确认红：
      `[data-testid^="stage-resize-"]` expected 0 received 8
- [x] 5.2 绿：四段——选中没有缩放手柄 / 双击不进顶点模式 / **闭合曲线对照**照旧有手柄与顶点模式 /
      拖它照常挪走且尺寸不变。断言在非 100% 缩放下做。
      对照取矩形而不是导线：**开放几何选中时画的是轮廓，本来就没有盒手柄**（曲线的整体缩放让给
      变换指示器），拿导线做对照会得到一条永远绿的假断言——这一条是跑出来才发现的。
      把 stage 谓词换回 `return true` 另做一次红，确认第二段真的在挡
- [x] 5.3 全量 `bun run test:e2e` 绿（315 条）。`wire-junction.spec.ts` 的「在接头正中央按下并拖动，
      挪走的是节点」仍绿——`movable` 保持 `true` 就是为它

## 6. 验证与文档

- [x] 6.1 `bun run lint` / `bun run typecheck` / `bun run test` / `bun run build` 全绿
      （`test` 在 turbo 满并发下两次各有一个**不同**的包超时，单跑与 `--concurrency=3` 全跑
      都是 55/55 绿，是机器负载而不是回归）
- [x] 6.2 `openspec validate update-junction-fixed-size --strict` 通过
- [x] 6.3 既有文档里已经被拉扁的接线点**不做迁移**（见 design 的风险一节），不写迁移器
