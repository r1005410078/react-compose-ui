## MODIFIED Requirements

### Requirement: 动画文件格式

`@compose-ui/animation` MUST 提供 Compose Animation 文件协议：文件只包含动画清单与
变量绑定（id、名称、时长、播放模式、bindings），MUST NOT 包含关键帧轨道——轨道仍存放
在被动画 Entity 的 `Animation` Component 上。文件 MUST 按**所属根 Frame** 分区承载清单，
分区键 MUST 是该 Frame 的 Entity id；一份文件 MAY 只承载一块场景的分区（编辑器默认的
一场景一文件），也 MAY 承载多块场景的分区（既有共享文件），两种形态 MUST 遵守同一套
解析、校验与序列化规则。
包 MUST 导出文件后缀与 media type 常量、按名称后缀识别动画文件的谓词、issue 式解析入口、
序列化入口与默认文件构造器；解析 MUST 拒绝未知版本、非法形状与非法清单并报告结构化 issue，
序列化与解析 MUST 可无损往返。文件版本 MUST 升到 2，并 MUST 提供 1→2 的显式单向迁移：
把单条清单放进该页面激活 Frame 的分区。动画文件是静态权威：宿主打开页面时把各分区水合进
对应 Frame 的 `Animations.items` 会话镜像，保存时把各镜像的变化回写其绑定的文件；本协议保持
无 React、无 DOM，仅依赖 core。

#### Scenario: 序列化与解析往返

- **WHEN** 宿主用多块场景的清单与绑定构造动画文件并序列化后再解析
- **THEN** 解析结果与原始清单逐字段相等且没有 issue
- **AND** 每条清单仍归属于原来的那个 Frame 分区

#### Scenario: 单场景文件同样合法

- **WHEN** 宿主构造只含一块场景分区的动画文件并序列化后再解析
- **THEN** 解析成功且该分区清单逐字段相等，不产生任何 issue

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
