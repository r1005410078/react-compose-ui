# 任务

## 1. 协议

- [x] 1.1 `CadPolyline`（`vertices` + `closed`）、`getCadPolyline`、`createCadPolylineEntity`
- [x] 1.2 `cadPolylineSegments`：顶点序列 → 线段序列，闭合多一段
- [x] 1.3 校验：至少两个顶点、坐标有限、包围盒跨度非零

## 2. 遍历与消费者

- [x] 2.1 顶层多段线展开成线段，共用同一个 `ownerId`
- [x] 2.2 块内多段线同样展开并经实例变换
- [x] 2.3 `translateCadEntity` 的多段线分支（全部顶点平移）
- [x] 2.4 确认命中、框选、捕捉、渲染四条路径**不需要改动**

## 3. 命令

- [x] 3.1 `PLINE` / `PL`：连点 + 闭合/放弃/结束三个关键字，产出一个 Entity
- [x] 3.2 `RECTANG` / `REC`：两个对角点，退化时拒绝
- [x] 3.3 i18n 文案与命令注册

## 4. 验证

- [x] 4.1 单测：闭合段数、退化拒绝、展开后 owner 一致、平移、两条会话
- [x] 4.2 组件测：画矩形是一个对象、窗口框选整体判定、点中一段选中整条
- [x] 4.3 e2e：非 100% 缩放下画矩形、拖动它整体移动
- [x] 4.4 每条新断言先确认去掉实现后变红
- [x] 4.5 五道门槛一起跑：`lint` / `typecheck` / `test` / `build` / `test:e2e`
