## 1. 协议（core）

- [x] 1.1 `Hatch.boundaryIds?: string[]`：类型、校验（空数组非法）、缺席即不跟随
- [x] 1.2 单测：缺席、空数组非法、既有文档逐字不变

## 2. 选点（core）

- [x] 2.1 `core/curve-region.ts` 新增最大内切圆圆心纯函数；弧边按固定份数采样
- [x] 2.2 带洞的面：洞的边界一并算，结果不得落在洞里
- [x] 2.3 退化的面返回缺席
- [x] 2.4 单测：矩形取中心、L 形不取包围盒中心、洞把圆心推开、退化返回缺席

## 3. 落地时记下清单（stage）

- [x] 3.1 `drafting-entity.ts` 把已经算出来的边界 id 写进 `Hatch.boundaryIds`
      （MUST 取层序用的那一份，不再求一次）
- [x] 3.2 改既有对象那一支不写 `Hatch`
- [x] 3.3 单测：新建那一支写下清单；改填充那一支不产出 `Hatch`

## 4. 跟随：派生，与导线并排（core / layout-engine）

- [x] 4.1 `core` 出 `resolveComposeHatches(document, snapshot)`，文档与快照成对返回；
      没有填充要解算时原样返回入参（引用不变）
- [x] 4.2 过滤：`boundaryIds` 里每个 Entity 的盒与几何都没变时连求都不求
- [x] 4.3 求解：把边界投影进各自的盒、搬到父级坐标，求包含落点的那块面
- [x] 4.4 两档分流：清单相同即写进去；不同即不动几何。求不出时保留作者几何
- [x] 4.5 跟随成功时重取锚点到最大内切圆圆心，并更新 `boundaryIds`
- [x] 4.6 跨父级的边界不跟随（与 `wire.parent-mismatch` 同一条）
- [x] 4.7 `layout-runtime` 在 `resolveComposeWires` 之后接上它；预览档跳过
- [x] 4.8 单测：跟上、不相干不触发、清单不同不动、求不出保留、引用不变、跨父级

## 5. 端口与 Inspector（component-registry / materials）

- [ ] 5.1 `ComposeHatchEditPort` 加 `detach`；`isStale` 升级成三档状态查询
- [ ] 5.2 Inspector：三档文案、「断开关联」按钮、「取点」改口成「锚点」
- [ ] 5.3 端口缺席时不画那几颗按钮
- [ ] 5.4 组件测试：三档各一条、断开之后 `Hatch` 消失而几何与填充色保留、端口缺席

## 6. 端到端

- [ ] 6.1 拖顶点 → 填充跟上；撤销一步回到改动之前，填充跟着回去
- [ ] 6.2 挪一个不相干的符号 → 填充一个字节不变
- [ ] 6.3 圆整个挪出去 → 几何不变且标过期；按「重新生成」之后跟上且清单更新
- [ ] 6.4 剪开边界 → 标失效且 `Hatch` 仍在；补上那一段后「重新生成」即回来
- [ ] 6.5 断开关联 → 再动边界它不动
- [ ] 6.6 拖动过程中填充不动（预览档不跑求面），松手才跟上
- [ ] 6.7 已落地（无 `boundaryIds`）的填充不跟随，第一次「重新生成」补上清单
- [ ] 6.8 用例 MUST 在非 100% 缩放下断言

## 7. 收尾

- [ ] 7.1 `bun run lint && bun run typecheck && bun run test && bun run build`
- [ ] 7.2 `bun run test:e2e`
- [ ] 7.3 按落地情况更新 `docs/mockups/drafting-hatch-assoc.html` 并重发 artifact（同一个 URL）
- [ ] 7.4 按需同步 `AGENTS.md`（三档、清单的两个用途、锚点语义的改变、不做分组）
