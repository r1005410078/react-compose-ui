# Tasks

## 1. 判别性用例先验红

- [x] 1.1 新增 `e2e/symbol-wires.spec.ts`：非 100% 缩放下给一个 Entity 声明端口，用 `WIRE`
      从端口画一条线出去，**把那个 Entity 拖走**，断言导线的端点跟着走。**先跑确认红**——
      今天没有 `WIRE`，线画完就与符号无关
- [x] 1.2 同一条继续：删掉被绑定的 Entity，断言导线仍在、几何保留、Inspector 标为失效

## 2. `core`：`Wire` Component 与求解

- [x] 2.1 类型、读取入口、内建 Component key
- [x] 2.2 校验：绑定**不完整**非法；指向不存在的实体或端口**不**判非法（解算失败而已）；
      导线与绑定实例不同父级给可判别码
- [x] 2.3 `resolveComposeWires(document, snapshot)`：按实例盒与旋转基点把端口换算到父级坐标，
      写进导线的 `Curve` 与盒；任一端解算失败就保留作者几何
- [x] 2.4 Vitest：跟随移动、跟随旋转、失败兜底、不同父级、自由端不受影响

## 3. `layout-engine`：一致对里包含导线

- [x] 3.1 `ready` 状态先解布局、再解导线、再把导线的盒补回快照
- [x] 3.2 导线是绝对定位，改它的盒不触发二次求解；在实现处写明理由
- [x] 3.3 Vitest：同一次求解产出的文档与快照对导线一致

## 4. `stage-engine` / `stage`：WIRE 与改接线

- [x] 4.1 `StageFeaturePoint` 带上 `portId`
- [x] 4.2 `WIRE` 命令：两点，取点来源逐点记下，产出带 `Wire` 的曲线 Entity
- [x] 4.3 几何编辑拖端点：落在端口上就绑、落在别处就解绑，`Wire` 与 `Curve` 同一个事务
- [x] 4.4 用例：绑定来自取点而不是坐标反查（一条路过端口的 `LINE` 不绑）

## 5. `materials`：Wire Inspector

- [x] 5.1 列出两端的绑定状态：自由 / 已绑到某端口 / 失效
- [x] 5.2 组件测试：三种状态各一条

## 6. 编辑器接线

- [x] 6.1 交给 Stage 的文档换成布局 Runtime 那份已解算的文档
- [x] 6.2 实测是否出现可见延迟；若有，退回两个渲染入口各自 memo 的方案并记进路线图。
      **没有出现**：146 条既有端到端用例一条没改即全绿
- [x] 6.3 **实现时才浮现**：`ready` 状态拆出 `sourceDocument`。预览与编辑器都用
      `state.document === 入参` 做身份判定，而解算之后 `document` 已不是入参，预览会永远
      停在 loading——这个坑只在文档里真有一条导线时才发生

## 7. 规范与文档

- [x] 7.1 四份规范增量
- [x] 7.2 AGENTS.md：导线段落
- [x] 7.3 路线图：步骤 11b 回填实测

## 8. 五道门

- [x] 8.1 `bun run lint`
- [x] 8.2 `bun run typecheck`
- [x] 8.3 `bun run test`
- [x] 8.4 `bun run build`
- [x] 8.5 `bun run test:e2e`
