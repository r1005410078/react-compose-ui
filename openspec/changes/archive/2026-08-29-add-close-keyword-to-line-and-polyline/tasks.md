## 1. 文案

- [x] 1.1 `StageDraftingMessages` 新增 `closeKeyword`
- [x] 1.2 Stage i18n 补 zh-CN / en-US

## 2. 命令

- [x] 2.1 `LINE` 记住第一个点，`C` 画一段回去并结束
- [x] 2.2 `PLINE` 的 `C` 置 `closed: true` 并提交
- [x] 2.3 关键字只在**够得着闭合**时出现（`LINE` 至少两点、`PLINE` 至少三点）

## 3. 关键字 chip

- [x] 3.1 `ComposeCommandLine` 把关键字渲染成可点按钮
- [x] 3.2 点击上报与键入同一个字母

## 4. 测试

- [x] 4.1 `LINE` 三点后 `C`：产出四段（含收尾那一段）且会话结束
- [x] 4.2 `PLINE` 三点后 `C`：一个 Entity、`closed` 为 true、会话结束
- [x] 4.3 顶点不够时没有闭合关键字
- [x] 4.4 组件测试：点 chip 与打字母等价
- [x] 4.5 端到端：闭合多段线渲染成一个 `<polygon>`

## 5. 验证

- [x] 5.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 5.2 `bun run test:e2e`
