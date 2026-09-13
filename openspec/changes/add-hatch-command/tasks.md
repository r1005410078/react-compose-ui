## 1. 协议与几何（core）

- [x] 1.1 `core/hatch.ts`：`Hatch` Component、类型、校验（`seed` 必填、MUST 与 `Curve` 组合），
      `COMPOSE_BUILTIN_COMPONENT_KEYS` 加一项；缺席即不是填充
- [x] 1.2 `core/curve-region.ts`：射线进面 → 绕行找环 → 岛 → 收成最窄 kind；失败时报出断口节点
- [x] 1.3 圆角多段线的边界走 `composePolylineOutline`（判别性用例：带 `cornerRadius` 的矩形，
      填出来的面不得越过角弧）
- [x] 1.4 弧边转三次贝塞尔（`core` 不能引 `svgpath`，写一份；用例断每 90° 一段的径向误差上界）
- [x] 1.5 单测：多对象拼出的面、岛与 `evenodd`、全直边取 `polyline`、不封闭报断口、共线重叠

## 2. 命令协议（commands）

- [x] 2.1 `pick` 输入补顶层 `point`；`targets` 可为空
- [x] 2.2 `badge` 联合加 `'bucket'`
- [x] 2.3 单测：落在空白处的 `pick` 仍带落点；未声明 `pick` 的一步收到它仍拒绝

## 3. 解算与规划（stage-engine）

- [x] 3.1 把 `boxCurve` / `worldShapes` 从 `curve-trim.ts` 提到共享模块，`TRIM` 改为引用它
      （此步 MUST 不改变 `TRIM` 的任何行为，既有用例全绿即通过）
- [x] 3.2 `commands/curve-hatch.ts`：`resolveStageHatchRegion`（悬停与落地共用）——
      候选筛选（可见、带 `Curve`、非接线点、非填充）、求面、两支判定
- [x] 3.3 「边界恰好是某一个 Entity 的**完整**几何」判定；自交折线走新建那一支
- [x] 3.4 `planStageHatch` 住 **`stage`** 而不是 `stage-engine`：新建那一支要 `hatch` Preset 与
      一个新 Entity id，而**引擎不建 Entity、不认识 Preset id**；两支都在宿主规划，才不会
      把同一件事拆到两个包里。改填充那一支写 `Appearance`；新建那一支走
      `createStageDraftingCurveCommand`，带 `Curve` + `Hatch`，并用 `entity.create` 的 `index`
      插在最靠后的边界之下；一次取用一个事务
- [x] 3.5 锁定目标拒绝并给出原因码；不封闭拒绝并带断口位置
- [x] 3.6 `drafting/hatch-command.ts`：`HATCH` / `H`，一步 `pick`，`badge: 'bucket'`，
      提交后不结束；注册进内建命令表
- [x] 3.7 `C` 关键字：切到接受颜色文本的一步，回到取点步
- [x] 3.8 单测：两支各自、锁定、自交折线、不封闭、层序、一次取用一个事务

## 4. 宿主与呈现（stage）

- [x] 4.1 `handlePick` 把落点透传进 `session.advance`
- [x] 4.2 悬停预览：读同一份解算，以当前填充色半透明画候选面
- [x] 4.3 断口记号（琥珀，复用失效端点 token）与四句互不相同的拒绝文案
- [x] 4.4 光标：`pick` 这一档加油漆桶徽标，不画十字线
- [x] 4.5 当前填充色的会话 ref、色板（扫文档取本页已用过的填充色）、`C` 关键字接线
- [ ] 4.6 组件测试：预览与落地同一块面；两支的提示文案不同；断口画在走不下去的节点上

## 5. 物料与图标（materials / editor）

- [x] 5.1 `hatch` Preset：有填充、无描边、`paletteHidden: 'toolbar'`；默认色**先量对比度再定**
- [ ] 5.2 Inspector：「重新生成」与失效标记；填充色走既有外观分组
- [x] 5.3 `StageToolbarIcon` 接受可选颜色参数（`style` 内联）；新增 `hatch` 图标（20 画幅、
      轮廓 `currentColor`、只有漆面填色）
- [x] 5.4 目录项 + 绘图货架第 17 格（排在 `TRIM` 之后）；页面货架不加
- [ ] 5.5 工具栏 split button 与色板弹出层
- [ ] 5.6 视觉回归：两套主题 × 近白/近黑/常规三档漆色，桶的剪影都成立

## 6. 端到端

- [ ] 6.1 圆压在矩形上 → 填矩形内圆外那块 → 落成 `path`，两个边界对象不动
- [ ] 6.2 点没有东西穿过的矩形 → 矩形自己被填上，文档不新增 Entity
- [ ] 6.3 线穿过矩形 → 点半边 → 新建一个填充对象，矩形仍空心
- [ ] 6.4 岛：矩形内有圆 → 挖空
- [ ] 6.5 不封闭 → 拒绝 + 断口记号；补上那一段后再点即成
- [ ] 6.6 层序：填充压在边界与区域内的符号之下
- [ ] 6.7 换色：工具栏色板与 `C` 关键字各一条
- [ ] 6.8 用例 MUST 在非 100% 缩放下断言（`world = (屏幕 − 视口) / zoom`）

## 7. 收尾

- [ ] 7.1 `bun run lint && bun run typecheck && bun run test && bun run build`
- [ ] 7.2 `bun run test:e2e`
- [ ] 7.3 `docs/mockups/drafting-hatch.html` 的琥珀圈按落地情况收成绿圈，并重发 artifact（同一个 URL）
- [ ] 7.4 按需同步 `AGENTS.md`（填充与对象填色的关系、两支判定、间隙容差的取舍）
