# Tasks

## 1. 判别性用例先验红

- [x] 1.1 新增 `e2e/component-ports.spec.ts`：非 100% 缩放下给一个 Entity 声明一个端口，
      让它**紧挨着**一条已有曲线的端点，启动 `LINE` 取点 → 断言捕捉标记是 `port` 且落点是
      端口而不是那个端点。**先跑确认红**——今天没有端口这回事
- [x] 1.2 同一条继续：端口写进文档、Inspector 读得回来、撤销一步消失

## 2. `core`：`Ports` Component

- [x] 2.1 类型、读取入口 `getComposePorts`、内建 Component key
- [x] 2.2 校验：id 唯一、位置有限、`items` 不得为空
- [x] 2.3 Vitest：合法与三类非法各一条

## 3. `stage-engine`：端口进特征点捕捉

- [x] 3.1 `StageFeatureSnapMode` 增 `'port'` 并排在 `MODE_ORDER` 最前
- [x] 3.2 候选来源放宽到「带 `Curve` 或带 `Ports`」，端口经同一个世界矩阵换算
- [x] 3.3 Vitest：端口与端点同距时端口胜出；端口更远时仍胜出（优先级严格先于距离）

## 4. `core`：实例端口的读取入口

- [x] 4.1 **改掉提案里的镜像方案**：读取入口合并「自己的 `Ports`」与「实例快照里组件根的
      `Ports`」，不复制。镜像要在创建与每一次刷新快照处各写一遍，而刷新走 `setRendererProps`
- [x] 4.2 实例自己声明的端口压过组件根的；快照形状不合时当作没有端口且不抛出
- [x] 4.3 Vitest：三条各一

## 5. `materials`：`Ports` Inspector

- [x] 5.1 内建 Component Inspector，走既有 `entity.component.update`
- [x] 5.2 组件测试：增删一项各派发一条命令

## 6. 规范与文档

- [x] 6.1 四份规范增量
- [x] 6.2 AGENTS.md：端口段落（Entity 能力、镜像的理由、捕捉次序）
- [x] 6.3 路线图：步骤 11 拆成 11a/11b 并回填实测

## 7. 五道门

- [x] 7.1 `bun run lint`
- [x] 7.2 `bun run typecheck`
- [x] 7.3 `bun run test`
- [x] 7.4 `bun run build`
- [x] 7.5 `bun run test:e2e`
