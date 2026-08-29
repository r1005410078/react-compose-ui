## 1. 参数化

- [x] 1.1 `core`：`ComposePointFieldKind` 新增 `radius` / `diameter`
- [x] 1.2 `radius` 的正反算与 `polar` 共用；`diameter` 在第一个字段上乘除二
- [x] 1.3 `commands`：`ComposeCommandPointFields` 同步这两个成员
- [x] 1.4 用例：`diameter` 正反算互逆且是 `radius` 的两倍；覆盖第一个字段时方向不变

## 2. 提示声明被量的那一段

- [x] 2.1 `ComposeCommandPrompt` 新增可选 `measured`，默认关闭
- [x] 2.2 用例：缺省时与从前一致

## 3. CIRCLE

- [x] 3.1 半径步声明 `radius` 并打开 `measured`
- [x] 3.2 `D` / `R` 关键字在 `radius` 与 `diameter` 之间切换，提示与关键字一并换
- [x] 3.3 切换只作用于本次会话
- [x] 3.4 文案：`specifyDiameter`、`diameterKeyword`、`radiusKeyword`
- [x] 3.5 用例：`D` 之后提示与 `fields` 都变；`R` 切回；半径为 0 仍被拒

## 4. ARC

- [x] 4.1 第三步打开 `measured`；第二步不打开
- [x] 4.2 用例：各步的 `fields` 与 `measured`

## 5. 标注几何

- [x] 5.1 `radius` / `diameter` 的单字段标注：一条平行偏移的标注线、两条延伸线、框在中点、
      在框后断开；不画角度弧
- [x] 5.2 `diameter` 的标注跨整条直径（对径点 → 光标），框带 `⌀` 前缀
- [x] 5.3 `measured` 打开时画出被量的那一段
- [x] 5.4 单元测试：单字段只出一个框；直径标注的两端是对径点与落点；`measured` 关闭时不画

## 6. Stage 接线

- [x] 6.1 单字段参数化下 `Tab` 不接管、不进入锁定
- [x] 6.2 覆盖层渲染被量的那一段

## 7. 测试

- [x] 7.1 组件测试：`CIRCLE` 取过圆心时只有一个数值框，且没有角度弧
- [x] 7.2 组件测试：`CIRCLE` 里按 `Tab` 走浏览器默认行为
- [x] 7.3 组件测试：`D` 之后同一个位置读数翻倍
- [x] 7.4 端到端：`C` 画圆、`D` 打直径 `300` 回车，落地的圆半径 150
- [x] 7.5 端到端：`A` 取两点时预览是直线，取第三点后是弧

## 8. 验证

- [x] 8.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 8.2 `bun run test:e2e`
