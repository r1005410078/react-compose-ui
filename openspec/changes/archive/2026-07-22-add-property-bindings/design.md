## 上下文

`@compose-ui/property-panel` 只拥有 Valibot 驱动的受控编辑 UI，不拥有正式页面文档、变量生命周期或
持久化。绑定必须能被独立宿主使用，并避免把变量引用混进 Valibot input。自定义 renderer 可能用一个
字段渲染多个逻辑输入，因此绑定地址需要同时包含字段路径和稳定子目标 ID。

## 目标/非目标

- 目标：已有页面/全局变量到显式声明逻辑输入的单向绑定。
- 目标：变量异常时保持 Canvas 可渲染，并把问题暴露给面板错误筛选。
- 目标：多行操作在任何操作列宽度下都可发现、可键盘访问且不被裁剪。
- 非目标：变量创建管理、表达式、数据源、转换函数、双向绑定或正式编辑器文档协议。

## 决策

### 绑定状态与解析

- 字面 `value` 和 bindings 分开受控；绑定地址由属性路径与 target ID 组成，内置 target ID 为 `value`。
- 绑定能力采用显式 opt-in：所有字段只有声明 `propertyPanel.binding.enabled: true` 才生成目标；
  自定义类型还必须由 renderer 声明 `bindingTargets`，metadata 负责业务授权，descriptor 负责子目标
  映射。任一条件缺失时，外部 binding 按 `unknown-target` 处理，不能影响 effective value。
- 变量是带当前快照值的页面或全局候选。候选先通过目标 Schema、语义 scope 和宿主 `canBind` 过滤。
- 纯解析函数按地址稳定排序应用绑定；单目标变量缺失或无效时回退对应字面值并产生 issue，最终候选仍
  通过完整根 Schema。绑定更新不触发 `onValueChange`。
- 自定义 renderer 在 registry 中声明纯 binding target descriptor：稳定 ID、Schema、scope 与字段值
  getter/setter。面板与 Canvas 复用同一 descriptor 解析。

### 操作轨道

- 操作列保持可调整，默认/最小/最大为 36/32/96px。每槽 27px，最多三槽；操作超过槽位时最后一槽
  用于溢出菜单。默认窄列中多个操作只显示菜单，不允许裁剪、自动撑宽或横向滚动。
- 操作按存在性/新增、重置、删除、移动排序；行上下文菜单提供完整操作集合。
- 绑定 trigger 属于编辑区 accessory，不参与操作槽计算。

### 绑定交互

- 所有显式启用的 binding trigger 始终可见，不依赖行 hover 或 focus；绑定、断链和错误状态通过颜色区分。
- trigger 位于每个逻辑输入旁的独立 accessory slot，不得绝对定位覆盖输入、单位、色块或选择箭头；
  只有显式启用绑定的目标生成槽位。槽位在未绑定时也保留，避免 hover 和绑定造成布局跳动。
- 常规槽位使用约 `36px × 20px` 的 UE4 风格仅图标按钮，窄复合输入可缩至约 `20px`；变量全名、
  解析预览与错误原因继续通过 tooltip、ARIA 和 picker 暴露。
- 已绑定输入保留焦点与预览但阻止字面编辑。解绑保留原字面值；reset 删除绑定并恢复 `defaultValue`。
- 绑定计入 modified；解析 issue 计入 errors。只读面板显示绑定状态但禁止更改。
- 数组移动/删除、record 改键/删除重映射地址；分组 reset、取消存在性、删除和 union 切换清理失效后代。

## 风险/权衡

- 数组使用索引路径，没有稳定 item ID → 面板在结构操作时同步重映射 bindings。
- 自定义 renderer getter/setter 可能不纯 → 公共契约与文档要求确定性且无副作用，并以解析单元测试约束。
- 当前变量值能通过 Schema 不代表未来值始终有效 → 每次解析重新校验并使用字面回退。
- 新公共协议可能被误当成正式数据源模型 → 类型只描述面板候选快照，文档明确持久化由宿主负责。
