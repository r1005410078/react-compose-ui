# 任务

## 1. 先红

- [x] 1.1 `e2e/polyline-grips.spec.ts` 改：拖段中点后顶点数不变，该段整体搬走
- [x] 1.2 同文件：直线的中点夹点画成条形
- [x] 1.3 单元用例：段平移的位移、相邻顶点不动、闭合收尾段
- [x] 1.4 跑 1.1–1.3 确认**都红**

## 2. stage-engine

- [x] 2.1 `applyStageCurveGrip` 的 `m{i}` 改成平移该段
- [x] 2.2 角色 `insert` 改名 `segment`；直线中点带上角色与方向角
- [x] 2.3 单元用例：插入那几条改成平移；越界仍放弃写入

## 3. stage

- [x] 3.1 `StageEditablePathVertex.role` 跟着改名
- [x] 3.2 样式选择器跟着改名

## 4. 文档

- [x] 4.1 `AGENTS.md`：段中点是平移；直线那条并入同一句；插入顶点归悬停菜单
- [x] 4.2 `docs/drafting-unification-roadmap.md` 记一条，写明上一刀错在哪句事实

## 5. 五道门

- [x] 5.1 `bun run lint`
- [x] 5.2 `bun run typecheck`
- [x] 5.3 `bun run test`
- [x] 5.4 `bun run build`
- [x] 5.5 `bun run test:e2e`

## 6. 观察项

- [x] 6.1 归一化让「某个顶点没动」观察不到：几何每次提交都按紧包围盒重新归一化，读 `points`
      时所有顶点都跟着盒平移。判别性改成读**顶点之间的向量**
- [x] 6.2 又踩了一次双击窗口：进入几何编辑的双击就落在第一段中点上，紧接着按下被算成连击的
      下一击，几何一动不动——看起来像求解没生效
