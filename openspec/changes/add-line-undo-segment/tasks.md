## 1. 引擎

- [x] 1.1 `StageDraftingEffect.undoLastCreated`
- [x] 1.2 `LINE` 记住点序列，`U` 回退一个点并带上 `undoLastCreated`
- [x] 1.3 只在有段可退时列出 `U`

## 2. 宿主

- [x] 2.1 记住本次会话建出来的 Entity id
- [x] 2.2 `undoLastCreated`：出栈并删掉那个 Entity
- [x] 2.3 协调：栈顶的 Entity 不在文档里了就回退会话一个点，并丢弃这一步的效果
- [x] 2.4 只有**曾经见过**的 id 消失才算删除（新建的要过一趟 React 才到 `document`）

## 3. 测试

- [x] 3.1 引擎：`U` 回退一个点且带 `undoLastCreated`
- [x] 3.2 组件：a→b→c 之后撤销，参考点回到 b
- [x] 3.3 端到端：撤销之后接着画，新段从 b 出发

## 4. 验证

- [x] 4.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 4.2 `bun run test:e2e`
