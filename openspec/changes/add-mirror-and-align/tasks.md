# 任务：MIRROR 命令与对齐分布

- [ ] 1.1 `core`：点/曲线绕任意轴反射的纯函数，反射后重新归一化几何与盒
- [ ] 1.2 `stage-engine`：`MIRROR` 两点会话（复用既有两点会话工厂），提示与预览
- [ ] 1.3 曲线与容器子树烘进几何：递归子级的 `LayoutItem.offset` 与 `Curve`，一次事务
- [ ] 1.4 组件实例走 `flip` prop 加 `rotation` 补偿；非轴对齐轴的分解用例
- [ ] 1.5 `materials`：component-instance 新增 `flip` prop 与渲染；默认 `'none'` 时既有实例
      逐像素不变
- [ ] 1.6 对齐六项与分布两项的纯函数（基准取选区整体包围盒），多选下的用例
- [ ] 1.7 注册成退化的一步命令，命令行可敲；不可用时给出 `disabledReason`
- [ ] 1.8 编辑器动作目录与工具栏接线、i18n
- [ ] 1.9 端到端：镜像一个刀闸符号；把一排端子左对齐并水平等距
- [ ] 1.10 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
