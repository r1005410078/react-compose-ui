## MODIFIED Requirements

### Requirement: 内建 Text 物料

Text Renderer MUST 提供与其可见样式一致的 Hug measurement，支持 Explicit/AtMost/Undefined 约束、
换行、font readiness 与 baseline，且 MUST 使用隔离测量 host 而不是 Scene Entity DOM。

Text MUST 声明原地文字编辑契约，把 `text` prop 标记为可原地编辑的纯文本，使 Stage 无需识别物料类型
即可提供画布内编辑。Text Renderer MUST 在编辑态以原地可编辑方式渲染该 prop，并保持字号、字重、颜色、
行高与对齐与非编辑态完全一致；MUST NOT 在编辑态改用与最终排版不一致的输入控件。

原地编辑 MUST 只承载纯文本，MUST NOT 接受富文本、区段样式或粘贴带来的 HTML 标记。

内容为空时 Text measurement MUST 仍量出该排版下的真实行高并保留一个光标宽度，MUST NOT 返回无效
尺寸——点击创建的文字以空内容进入编辑，测量失败会让 Hug 拿不到高度、光标无处落脚，并在画布上留下
测量诊断。

#### Scenario: 字体完成后更新 Text Hug
- **WHEN** Text 首次用 fallback 字体测量后目标字体完成加载
- **THEN** measurement revision 使 Text 与其 Auto Layout 祖先重新布局
- **AND** 不产生文档事务或读取 Stage/Preview Entity DOM

#### Scenario: 编辑态保持排版一致

- **WHEN** 一段设置了字号、字重、颜色与居中对齐的 Text 进入原地编辑
- **THEN** 编辑中的文字仍以同一套排版样式呈现
- **AND** 退出编辑后视觉不发生跳变

#### Scenario: 空内容仍量出行高

- **WHEN** 一段 Text 的内容为空且宽高均为 Hug
- **THEN** measurement 返回该排版下的行高与一个光标宽度，而不是无效尺寸
- **AND** 画布上不出现内容测量诊断

#### Scenario: 粘贴富文本只保留纯文本

- **WHEN** 用户在原地编辑中粘贴带样式的富文本内容
- **THEN** 只有纯文本进入 `text` prop
- **AND** 文档中不出现 HTML 标记
