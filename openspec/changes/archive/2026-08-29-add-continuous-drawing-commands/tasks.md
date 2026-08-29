## 1. 协议

- [x] 1.1 `ComposeCommandDefinition` 新增可选 `repeat`
- [x] 1.2 用例：缺省时与从前一致

## 2. 命令声明

- [x] 2.1 `WIRE` 与 `ARROW` 声明 `repeat`
- [x] 2.2 用例：其余五条绘图命令都不声明

## 3. Stage 接线

- [x] 3.1 `commit` 之后，命令声明了 `repeat` 就以同一个 id 重开一条全新会话
- [x] 3.2 `activeCommandId` 在重启期间 MUST NOT 闪成 `null`（工具栏按下态读它）
- [x] 3.3 重启 MUST NOT 触碰选择集
- [x] 3.4 `Escape` 分两级：取过点则放弃这一条、命令留着；没取过点才退出

## 4. 测试

- [x] 4.1 组件测试：`WIRE` 画完一条之后提示回到第一步、命令仍在跑
- [x] 4.2 组件测试：连画三条得到三个 Entity
- [x] 4.3 组件测试：`RECTANGLE` 画完即结束
- [x] 4.4 组件测试：取过一个点时 `Escape` 只放弃这一条；再按一次才退出
- [x] 4.5 组件测试：重启期间 `onActiveCommandChange` 没有报过 `null`
- [x] 4.6 端到端：工具栏的导线按钮在连画多条期间一直是按下态

## 5. 验证

- [x] 5.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 5.2 `bun run test:e2e`
