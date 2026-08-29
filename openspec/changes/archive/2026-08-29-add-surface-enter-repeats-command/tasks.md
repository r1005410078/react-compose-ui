## 1. 实现

- [x] 1.1 `handleKeyDown` 的 `Enter` 分支：没有会话时改为走 `submit('')`，与命令行的空确认
      同一条路径
- [x] 1.2 没有上一条命令时 MUST NOT 接管——否则 `Enter` 在图面上变成一个吃掉事件的黑洞

## 2. 测试

- [x] 2.1 组件测试：画完一条命令后在图面上按 `Enter`，同一条命令重新启动
- [x] 2.2 组件测试：从未启动过命令时图面上的 `Enter` 不被接管
- [x] 2.3 组件测试：命令进行中的 `Enter` 仍是推进一步

## 3. 验证

- [x] 3.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 3.2 `bun run test:e2e`
