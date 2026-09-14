# 任务

## 1. 协议与物料

- [ ] 1.1 `component-registry`：`ComposeRendererDefinition.minimumLegibleSize` 可选字段（TSDoc 说明
      两轴各自可选、「声明的每一轴都低于阈值才裁」、单位是屏幕像素）
- [ ] 1.2 `materials`：文字声明 `{ height: 5 }`，曲线声明 `{ width: 1, height: 1 }`，注释写清取值来源
      （5px 盒高约合 4px 字号；一个像素之内的形状画出来只是一个被量化的点）

## 2. 判定（`stage-engine`，纯函数）

- [ ] 2.1 `resolveStageDetailCulledIds(index, zoomStep, legibleSizeOf)`：按档位下界缩放，对每个叶子
      Entity 用世界包围盒 × 缩放与声明比较
- [ ] 2.2 单测：档位 A 可读 / 更低档位 B 不可读；只声明高度时宽度不参与；两轴都声明时长细线照画；
      未声明永不裁；档内任意缩放与档位下界判定一致

## 3. 接入（`stage`）

- [ ] 3.1 `useStageCulling`：可见集 = 窗口内 ∩ 可读；豁免、近全集短路照旧；额外交出
      `detailCulledEntityIds`
- [ ] 3.2 `StageSceneLayer`：批次键变化时，目标差集里落在可读性集合中的进分批队列，其余当帧到齐
- [ ] 3.3 单测：被可读性裁掉的 Entity 选中即出现；跨档时两半各走各的路

## 4. 验收

- [ ] 4.1 端到端：EMS.dxf 适配后文字节点数为 0，放大之后回来，场景树选中被裁文字即出现
- [ ] 4.2 端到端全绿；裁剪对命中、框选、吸附、场景树不可见（沿用视口裁剪那几条）
- [ ] 4.3 量帧时间（有头 Chromium、真实 rAF 间隔、生产构建）：适配档与 0.2/0.3 档平移的 p50/p95，
      放大跨过阈值那一帧的长度；数字记在这里，不进断言
- [ ] 4.4 归档时把「可读性」并进 AGENTS.md 的裁剪条目
