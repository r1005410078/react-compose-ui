# @compose-ui/interaction-kernel

**零运行时依赖**、无 React、无 DOM、不认识任何文档协议的交互内核。

内容只有三样：插件契约、按优先级排序的注册表、同时至多一个会话的仲裁器。内核逻辑本身完全
不认识文档，只有类型签名通过 `InteractionKernelProfile` 认识——新文档类型声明自己的 profile
即可复用同一套仲裁规则。

「内核不认识文档」这条边界由**包依赖**承载而不是命名约定：本包 `dependencies` 为空，想引用
文档类型必须先加一条依赖，而那条依赖会被本包的边界用例挡下。

今天的消费者是 `@compose-ui/stage-engine`（页面编辑舞台）与 `@compose-ui/cad`（CAD 图纸）。
