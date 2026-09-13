## ADDED Requirements

### Requirement: Stage 十字光标样式

Stage MUST 接受 `crosshairStyle`（`fade` | `halo`）并原样交给共享十字光标，MUST NOT 自己
另画一份；缺席 MUST 为 `fade`。样式 MUST NOT 参与形态推导——画线还是画框仍只由当前等待
的输入类型决定。

浅色主题下 Stage MUST 把晕圈 token 指向图面自己的底色（`--compose-surface-control`）：
晕圈的用处是垫出一圈与底相同的颜色，取工作区底色会在浅色图面上留下一圈灰边。

#### Scenario: 宿主选晕圈

- **WHEN** 宿主传 `crosshairStyle="halo"`，绘图命令正等待取点
- **THEN** 图面在四条十字线之下画出四条晕圈线

#### Scenario: 缺席即渐隐

- **WHEN** 宿主不传 `crosshairStyle`，绘图命令正等待取点
- **THEN** 图面画渐隐十字线，没有晕圈线
