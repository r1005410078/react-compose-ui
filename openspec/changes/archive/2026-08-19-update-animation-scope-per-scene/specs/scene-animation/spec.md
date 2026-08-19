## MODIFIED Requirements

### Requirement: 动画文件格式

`@compose-ui/animation` MUST 提供 Compose Animation 文件协议：文件只包含动画清单与
变量绑定（id、名称、时长、播放模式、bindings），MUST NOT 包含关键帧轨道——轨道仍存放
在被动画 Entity 的 `Animation` Component 上。文件 MUST 按**所属根 Frame** 分区承载清单，
使一个页面的多块场景共用一份文件而互不影响；分区键 MUST 是该 Frame 的 Entity id。
包 MUST 导出文件后缀与 media type 常量、按名称后缀识别动画文件的谓词、issue 式解析入口、
序列化入口与默认文件构造器；解析 MUST 拒绝未知版本、非法形状与非法清单并报告结构化 issue，
序列化与解析 MUST 可无损往返。文件版本 MUST 升到 2，并 MUST 提供 1→2 的显式单向迁移：
把单条清单放进该页面激活 Frame 的分区。动画文件是静态权威：宿主打开页面时把各分区水合进
对应 Frame 的 `Animations.items` 会话镜像，保存时把各镜像的变化回写同一份文件；本协议保持
无 React、无 DOM，仅依赖 core。

#### Scenario: 序列化与解析往返

- **WHEN** 宿主用多块场景的清单与绑定构造动画文件并序列化后再解析
- **THEN** 解析结果与原始清单逐字段相等且没有 issue
- **AND** 每条清单仍归属于原来的那个 Frame 分区

#### Scenario: 拒绝非法动画文件

- **WHEN** 解析入口收到未知版本、缺失清单或清单字段非法的内容
- **THEN** 返回结构化 issue 而不抛出异常，也不产生部分解析结果

#### Scenario: 按名称识别动画文件

- **WHEN** 宿主用文件名谓词过滤资源目录
- **THEN** 只有携带动画文件后缀的条目被识别为动画文件，无需 Provider 理解 media type

#### Scenario: 动画文件 1 到 2 显式迁移

- **WHEN** 宿主对只含单条 `animation` 的 v1 动画文件执行显式迁移，并给出目标 Frame id
- **THEN** 得到 version 2 文件，原清单出现在该 Frame 的分区里
- **AND** 普通解析对 v1 文件返回结构化 issue，且迁移不修改输入

#### Scenario: 只取目标场景的分区

- **WHEN** 预览或发布以某一块场景为目标渲染
- **THEN** 只有该 Frame 分区的清单参与播放
- **AND** 同一文件中其他场景的清单不影响该次渲染

### Requirement: Frame 动画关联写入

Frame MUST 支持可选的动画稳定资源引用：`Animations.source` 保存 providerId、assetKey 与
scope。解析 MUST 容忍字段缺失并归一化为 null，非 null 时 MUST 校验引用形状。多个 Frame
MAY 持有指向同一个文件的引用；宿主 MUST 能以关联、更换和解除三种操作原子改写**单个 Frame**
的引用，且 MUST NOT 因此改动其他 Frame 的引用。实现 MUST NOT 解析动画文件内容、
MUST NOT 根据文件名隐式猜测动画关系，也 MUST NOT 因解除引用自动删除动画资源。

#### Scenario: 旧文档容缺解析

- **WHEN** 解析一个 `Animations` 不含 `source` 的既有文档
- **THEN** 解析成功且动画引用归一化为 null，清单与轨道不受影响

#### Scenario: 关联稳定动画引用

- **WHEN** 宿主把一个可引用动画文件关联到某个 Frame
- **THEN** `Animations.source` 写入其 providerId、assetKey 与持久性 scope
- **AND** 动画文件随后重命名或移动不改变该关联

#### Scenario: 解除动画不删除资源

- **WHEN** 用户解除某 Frame 当前的动画引用
- **THEN** `Animations.source` 被清空且轨道保持不变
- **AND** 原动画文件仍由 Asset Provider 保留
