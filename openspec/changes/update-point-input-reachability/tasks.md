## 1. 裸数字的垫底落点

- [x] 1.1 单字段参数化且指针位置未知时，按参考点加任意方向垫一个落点
- [x] 1.2 两字段参数化保持原样（不落点）
- [x] 1.3 端到端：命令行敲 `CIRCLE` + 圆心 + `14`

## 2. 参考点排除出捕捉

- [x] 2.1 `snapExcludedPoint` 在夹点原位置之外并上会话的 `reference`
- [x] 2.2 端到端：圆心压在已有端点上仍画得出 r=6 的圆

## 3. 验证

- [x] 3.1 `bun run lint`
- [x] 3.2 `bun run typecheck`
- [x] 3.3 `bun run test`
- [x] 3.4 `bun run build`
- [x] 3.5 `bun run test:e2e`
