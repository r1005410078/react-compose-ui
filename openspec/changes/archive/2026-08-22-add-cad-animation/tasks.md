# 任务

## 1. 采样器泛型化

- [x] 1.1 `applyComposeAnimationAtTime` 签名放宽到「任何带 `entities` 的文档」，实现不变
- [x] 1.2 既有页面用例全绿即证明没有行为变化

## 2. 协议

- [x] 2.1 `CadDocument.animations`（顶层清单），缺省读作空数组
- [x] 2.2 校验：id 非空且唯一、`durationMs` 有限正数、`playbackMode` 合法
- [x] 2.3 `CadStroke.dashOffset`（世界单位）与校验
- [x] 2.4 `getCadAnimations(document)` 归一化读取入口

## 3. 命令

- [x] 3.1 `cad.animation.flow` handler：建清单条目 + 逐 Entity 写 `Animation` 轨道，
      没有线型时补默认虚线；一个事务
- [x] 3.2 `FLOW` / `FL` 会话（先选后执行），i18n 与注册

## 4. 画布

- [x] 4.1 播放会话：rAF 播放头，无动画时不起循环，`animationEnabled` 可关
- [x] 4.2 采样只喂渲染；命中、捕捉、框选与命令仍读作者文档
- [x] 4.3 `stroke-dashoffset` 随缩放变化（与 `dashPattern` 同一条规则）

## 5. 验证

- [x] 5.1 单测：清单校验、轨道随 Entity 删除、`FLOW` 的周期与默认线型、采样泛型两种文档一致
- [x] 5.2 组件测：播放推进虚线偏移、关闭后停在起点、播放中仍点得中
- [x] 5.3 e2e：画线 → `FLOW` → 偏移随时间变化
- [x] 5.4 每条新断言先确认去掉实现后变红
- [x] 5.5 五道门槛一起跑：`lint` / `typecheck` / `test` / `build` / `test:e2e`
