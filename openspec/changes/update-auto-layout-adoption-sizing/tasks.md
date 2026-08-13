# 任务

## 1. 采纳规则

- [ ] 1.1 Red：在 stage-engine 补纯函数测试——固定交叉轴子级进入 stretch 容器后变 `fill`、
      保留原值为回退；`hug`/`fill`、显式 `alignSelf`、非 stretch 父级四种情况均不改写
- [ ] 1.2 Green：抽出 `adoptCrossAxisSizing(parentLayout, item)` 纯函数，按 `flexDirection`
      判定交叉轴
- [ ] 1.3 接入 `createReparentCommand` 的 `targetManagesFlow` 分支

## 2. 创建落点

- [ ] 2.1 确认从 Palette 拖入与资源批量拖入落到容器时走哪条命令，补齐同一规则
- [ ] 2.2 覆盖「拖入 stretch 容器的 Rectangle 填满交叉轴」的用例

## 3. 验证

- [ ] 3.1 e2e：容器设为 Auto Layout + 交叉轴拉伸，拖入两个 Rectangle，断言其高度等于容器内容高
- [ ] 3.2 运行 lint、typecheck、test、build、test:e2e
- [ ] 3.3 `openspec validate update-auto-layout-adoption-sizing --strict`
