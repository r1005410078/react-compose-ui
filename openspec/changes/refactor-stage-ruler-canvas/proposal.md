# 变更：标尺改用 Canvas 并对齐网格

## 原因

当前标尺用 SVG 逐刻度渲染，存在两处实测缺陷，且与既有规范「ruler label、tick、细线与主线
在相同世界位置对齐」不符：

- **数字不对齐刻度线**：标签用 `x="2"` 加 `text-anchor: start` 左对齐排字。世界坐标 0 的刻度线
  在 x=384，标签「0」实测占 387–392.4，中心偏右 5.7px；垂直标尺的标签再经 `rotate(90)`，
  偏移方向也随之旋转。
- **刻度线与网格线恒定错开 0.5px**：两者点阵一致（X 轴 world −80 与网格线同在 384），但成像
  规则不同——SVG `stroke-width: 1` 以坐标为中心覆盖 383.5–384.5，CSS
  `linear-gradient(色 1px, transparent 1px)` 从坐标向右覆盖 384–385。1x 屏上刻度线糊在两列
  像素之间，2x 屏上差整整一个物理像素。

同时，74 刻度/轴产生 322 个 SVG 节点，viewport 每次变化都要全量重建并由 React reconcile，
而平移是 pointermove 频率。

## 变更内容

- 标尺渲染改为 Canvas 2D：单个 canvas 承载刻度、数字、选区标记与游标线，按
  `devicePixelRatio` 取整绘制 1px 实线，消除半像素模糊。
- 画布网格**保持** CSS 多层 gradient 不变。网格当前是 1 个 div、GPU 合成、每帧零 JS，
  改 canvas 是纯亏；对齐改由标尺与网格共用同一个纯点阵函数与同一套设备像素取整规则保证。
- 标尺视觉对齐 Figma：数字居中于所属刻度线；保留细刻度并与数字刻度、主网格刻度形成三级
  层次（短线 / 长线 / 高亮），细刻度按 8px 不粘连阈值抽稀，数字按 48px 可读性阈值抽稀。
- 选中对象在标尺上的区间高亮按 Figma 重做，保留起止端点与尺寸数字。
- 新增指针位置游标线：标尺上跟随鼠标的高亮标记，随指针离开 Stage 消失。
- **修复**：从顶部 ruler 拖出的是垂直 guide、从左侧拖出的是水平 guide，方向恰好相反。
  ruler 的轴与 guide 的轴互为反向，创建与删除判定一并修正。
- 辅助线拖回所属 ruler 时新增删除光标提示（箭头右下角带红叉），语义光标新增 `guide-delete`。

## 影响

- 受影响的规范：`stage`
- 受影响的代码：`packages/stage`（`stage-ruler/`、`grid-rendering.ts`、`styles.css`）、
  `packages/stage-engine`（点阵与取整纯函数、辅助线手势）、`e2e/integration.spec.ts`
- **BREAKING**（测试契约）：标尺不再输出 `g[data-world-value]` 节点。`stage-ruler-x`/
  `stage-ruler-y`/`stage-ruler-corner` test ID 与 ARIA 保留在容器上；刻度位置断言改为纯点阵
  单测加黄金图，e2e 中 6 处依赖 `data-world-value` 的断言需要改写。
- 公共 API 增加：`StageInteractionSnapshot.cursor` 新增 `'guide-delete'`，新增 `guideDelete` 字段；
  `ComposeStage` 对外 props 不变，无文档协议变更。
