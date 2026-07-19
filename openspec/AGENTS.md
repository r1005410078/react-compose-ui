# OpenSpec 使用说明

本说明面向使用 OpenSpec 进行规范驱动开发的 AI 编码助手。

## 快速检查清单

- 搜索已有工作：`openspec spec list --long`、`openspec list`（仅在全文搜索时使用 `rg`）
- 确定范围：新增能力，还是修改现有能力
- 选择唯一的 `change-id`：使用 kebab-case，并以动词开头（`add-`、`update-`、`remove-`、`refactor-`）
- 创建骨架：`proposal.md`、`tasks.md`、`design.md`（仅在需要时），以及每个受影响能力的增量规范
- 编写增量：使用 `## ADDED|MODIFIED|REMOVED|RENAMED Requirements`；每条需求至少包含一个 `#### Scenario:`
- 验证：运行 `openspec validate [change-id] --strict` 并修复问题
- 请求批准：提案获批前不要开始实现

## 三阶段工作流

### 阶段 1：创建变更

在以下情况中创建提案：
- 添加功能或能力
- 进行破坏性变更（API、Schema）
- 改变架构或模式
- 优化性能（会改变行为）
- 更新安全模式

触发语句示例：
- “帮我创建一个变更提案”
- “帮我规划一个变更”
- “帮我创建一个提案”
- “我想创建一个规范提案”
- “我想创建一份规范”

宽松匹配指南：
- 包含以下任一词：`proposal`、`change`、`spec`
- 同时包含以下任一词：`create`、`plan`、`make`、`start`、`help`

以下情况跳过提案：
- Bug 修复（恢复预期行为）
- 拼写、格式、注释修改
- 非破坏性的依赖更新
- 配置变更
- 针对现有行为的测试

**工作流**
1. 查看 `openspec/project.md`、`openspec list` 和 `openspec list --specs`，了解当前上下文。
2. 选择唯一且以动词开头的 `change-id`，并在 `openspec/changes/<id>/` 下创建 `proposal.md`、`tasks.md`、可选的 `design.md` 及规范增量。
3. 使用 `## ADDED|MODIFIED|REMOVED Requirements` 编写规范增量，每条需求至少包含一个 `#### Scenario:`。
4. 运行 `openspec validate <id> --strict`，解决所有问题后再分享提案。

### 阶段 2：实现变更

将以下步骤记录为 TODO，并逐项完成。
1. **阅读 proposal.md**——理解要构建的内容
2. **阅读 design.md**（如果存在）——检查技术决策
3. **阅读 tasks.md**——获取实现检查清单
4. **按顺序实现任务**——依次完成
5. **确认完成情况**——更新状态前，确保 `tasks.md` 中的每一项都已完成
6. **更新检查清单**——所有工作完成后，将每项任务设置为 `- [x]`，确保清单反映实际情况
7. **批准门禁**——提案完成审查并获批前，不要开始实现

### 阶段 3：归档变更

部署后创建一个单独的 PR，用于：
- 将 `changes/[name]/` 移动到 `changes/archive/YYYY-MM-DD-[name]/`
- 如果能力发生变化，更新 `specs/`
- 对仅涉及工具的变更，使用 `openspec archive <change-id> --skip-specs --yes`（必须始终显式传入变更 ID）
- 运行 `openspec validate --strict`，确认归档后的变更通过检查

## 开始任何任务之前

**上下文检查清单：**
- [ ] 阅读 `specs/[capability]/spec.md` 中的相关规范
- [ ] 检查 `changes/` 中待处理的变更是否存在冲突
- [ ] 阅读 `openspec/project.md` 了解约定
- [ ] 运行 `openspec list` 查看活动中的变更
- [ ] 运行 `openspec list --specs` 查看已有能力

**创建规范之前：**
- 始终检查相关能力是否已经存在
- 优先修改已有规范，避免创建重复规范
- 使用 `openspec show [spec]` 查看当前状态
- 如果请求含义不明确，在创建骨架前询问 1～2 个澄清问题

### 搜索指南

- 列出规范：`openspec spec list --long`（脚本中可使用 `--json`）
- 列出变更：`openspec list`（也可使用已弃用但仍可用的 `openspec change list --json`）
- 显示详情：
  - 规范：`openspec show <spec-id> --type spec`（筛选时使用 `--json`）
  - 变更：`openspec show <change-id> --json --deltas-only`
- 全文搜索（使用 ripgrep）：`rg -n "Requirement:|Scenario:" openspec/specs`

## 快速开始

### CLI 命令

```bash
# 核心命令
openspec list                  # 列出活动中的变更
openspec list --specs          # 列出规范
openspec show [item]           # 显示变更或规范
openspec validate [item]       # 验证变更或规范
openspec archive <change-id> [--yes|-y]   # 部署后归档（非交互运行时添加 --yes）

# 项目管理
openspec init [path]           # 初始化 OpenSpec
openspec update [path]         # 更新说明文件

# 交互模式
openspec show                  # 提示选择项目
openspec validate              # 批量验证模式

# 调试
openspec show [change] --json --deltas-only
openspec validate [change] --strict
```

### 命令参数

- `--json`——输出机器可读格式
- `--type change|spec`——明确项目类型
- `--strict`——执行完整验证
- `--no-interactive`——禁用交互提示
- `--skip-specs`——归档时不更新规范
- `--yes`/`-y`——跳过确认提示（非交互归档）

## 目录结构

```text
openspec/
├── project.md              # 项目约定
├── specs/                  # 当前事实——已经构建的内容
│   └── [capability]/       # 单一且聚焦的能力
│       ├── spec.md         # 需求与场景
│       └── design.md       # 技术模式
├── changes/                # 提案——应该发生的变更
│   ├── [change-name]/
│   │   ├── proposal.md     # 原因、内容、影响
│   │   ├── tasks.md        # 实现检查清单
│   │   ├── design.md       # 技术决策（可选，参见判断标准）
│   │   └── specs/          # 增量变更
│   │       └── [capability]/
│   │           └── spec.md # ADDED/MODIFIED/REMOVED
│   └── archive/            # 已完成的变更
```

## 创建变更提案

### 决策树

```text
收到新请求？
├─ 修复 Bug，以恢复规范中的行为？→ 直接修复
├─ 拼写/格式/注释修改？→ 直接修复
├─ 新功能/新能力？→ 创建提案
├─ 破坏性变更？→ 创建提案
├─ 架构变更？→ 创建提案
└─ 不明确？→ 创建提案（更稳妥）
```

### 提案结构

1. **创建目录：**`changes/[change-id]/`（kebab-case、以动词开头、保持唯一）

2. **编写 proposal.md：**

```markdown
# 变更：[变更的简短描述]

## 原因
[用 1～2 句话说明问题或机会]

## 变更内容
- [变更项目列表]
- [使用 **BREAKING** 标记破坏性变更]

## 影响
- 受影响的规范：[能力列表]
- 受影响的代码：[关键文件/系统]
```

3. **创建规范增量：**`specs/[capability]/spec.md`

```markdown
## ADDED Requirements
### Requirement: 新功能
系统必须提供……

#### Scenario: 成功场景
- **WHEN** 用户执行某个操作
- **THEN** 得到预期结果

## MODIFIED Requirements
### Requirement: 现有功能
[完整的修改后需求]

## REMOVED Requirements
### Requirement: 旧功能
**原因**：[删除原因]
**迁移**：[处理方式]
```

如果变更影响多个能力，请在 `changes/[change-id]/specs/<capability>/spec.md` 下为每个能力创建一个增量文件。

4. **创建 tasks.md：**

```markdown
## 1. 实现
- [ ] 1.1 创建数据库 Schema
- [ ] 1.2 实现 API 端点
- [ ] 1.3 添加前端组件
- [ ] 1.4 编写测试
```

5. **在需要时创建 design.md：**

出现以下任一情况时创建 `design.md`，否则省略：
- 横跨多个服务/模块的变更，或引入新的架构模式
- 引入新的外部依赖，或进行重大数据模型变更
- 存在安全、性能或迁移复杂性
- 请求存在歧义，适合在编码前先做技术决策

最小 `design.md` 骨架：

```markdown
## 上下文
[背景、约束、利益相关方]

## 目标/非目标
- 目标：[…]
- 非目标：[…]

## 决策
- 决策：[内容与原因]
- 考虑过的替代方案：[选项与理由]

## 风险/权衡
- [风险] → 缓解措施

## 迁移计划
[步骤、回滚方案]

## 待解决问题
- […]
```

## 规范文件格式

### 关键要求：场景格式

**正确**（使用四级标题）：

```markdown
#### Scenario: 用户登录成功
- **WHEN** 提供有效凭据
- **THEN** 返回 JWT Token
```

**错误**（不要使用项目符号、粗体或三级标题）：

```markdown
- **Scenario: 用户登录**  ❌
**Scenario**: 用户登录     ❌
### Scenario: 用户登录      ❌
```

每条需求必须至少包含一个场景。

### 需求措辞

- 规范性需求使用 SHALL/MUST（必须）；除非有意表达非规范性含义，否则避免使用 should/may。

### 增量操作

- `## ADDED Requirements`——新增能力
- `## MODIFIED Requirements`——修改行为
- `## REMOVED Requirements`——弃用功能
- `## RENAMED Requirements`——名称变更

标题通过 `trim(header)` 匹配，因此会忽略空白字符。

#### 何时使用 ADDED，何时使用 MODIFIED

- ADDED：引入可以作为独立需求存在的新能力或子能力。如果变更与现有需求正交（例如添加“斜杠命令配置”），应优先使用 ADDED，而不是修改现有需求的语义。
- MODIFIED：改变现有需求的行为、范围或验收标准。必须粘贴完整且更新后的需求内容（标题及全部场景）。归档工具会用这里提供的内容替换整条需求；不完整的增量会导致旧内容丢失。
- RENAMED：仅在名称变化时使用。如果行为也发生变化，请同时使用 RENAMED（名称）和引用新名称的 MODIFIED（内容）。

常见错误：使用 MODIFIED 添加新关注点，却没有包含原有文本。这会导致归档时丢失细节。如果没有明确修改现有需求，应改为在 ADDED 下添加新需求。

正确编写 MODIFIED 需求：
1. 在 `openspec/specs/<capability>/spec.md` 中找到现有需求。
2. 复制完整需求块（从 `### Requirement: ...` 到它的所有场景）。
3. 将它粘贴到 `## MODIFIED Requirements` 下，并根据新行为进行编辑。
4. 确保标题文本完全匹配（忽略空白），并至少保留一个 `#### Scenario:`。

RENAMED 示例：

```markdown
## RENAMED Requirements
- FROM: `### Requirement: Login`
- TO: `### Requirement: User Authentication`
```

## 故障排查

### 常见错误

**“Change must have at least one delta”（变更必须至少包含一个增量）**
- 检查 `changes/[name]/specs/` 是否存在 `.md` 文件
- 确认文件包含操作前缀，例如 `## ADDED Requirements`

**“Requirement must have at least one scenario”（需求必须至少包含一个场景）**
- 检查场景是否使用 `#### Scenario:` 格式（四个 `#`）
- 场景标题不要使用项目符号或粗体

**场景解析静默失败**
- 必须使用精确格式：`#### Scenario: Name`
- 使用以下命令调试：`openspec show [change] --json --deltas-only`

### 验证技巧

```bash
# 始终使用严格模式执行完整检查
openspec validate [change] --strict

# 调试增量解析
openspec show [change] --json | jq '.deltas'

# 检查特定需求
openspec show [spec] --json -r 1
```

## 顺利流程脚本

```bash
# 1）了解当前状态
openspec spec list --long
openspec list
# 可选的全文搜索：
# rg -n "Requirement:|Scenario:" openspec/specs
# rg -n "^#|Requirement:" openspec/changes

# 2）选择变更 ID 并创建骨架
CHANGE=add-two-factor-auth
mkdir -p openspec/changes/$CHANGE/{specs/auth}
printf "## Why\n...\n\n## What Changes\n- ...\n\n## Impact\n- ...\n" > openspec/changes/$CHANGE/proposal.md
printf "## 1. Implementation\n- [ ] 1.1 ...\n" > openspec/changes/$CHANGE/tasks.md

# 3）添加增量（示例）
cat > openspec/changes/$CHANGE/specs/auth/spec.md << 'EOF'
## ADDED Requirements
### Requirement: Two-Factor Authentication
Users MUST provide a second factor during login.

#### Scenario: OTP required
- **WHEN** valid credentials are provided
- **THEN** an OTP challenge is required
EOF

# 4）验证
openspec validate $CHANGE --strict
```

## 多能力示例

```text
openspec/changes/add-2fa-notify/
├── proposal.md
├── tasks.md
└── specs/
    ├── auth/
    │   └── spec.md   # ADDED：双因素认证
    └── notifications/
        └── spec.md   # ADDED：OTP 邮件通知
```

auth/spec.md：

```markdown
## ADDED Requirements
### Requirement: Two-Factor Authentication
...
```

notifications/spec.md：

```markdown
## ADDED Requirements
### Requirement: OTP Email Notification
...
```

## 最佳实践

### 简单优先

- 默认新增代码少于 100 行
- 在证明单文件不足之前，优先采用单文件实现
- 没有明确理由时不要引入框架
- 选择朴素且经过验证的模式

### 引入复杂性的条件

仅在以下情况中增加复杂性：
- 性能数据表明当前方案过慢
- 存在具体的规模要求（超过 1000 名用户或 100 MB 数据）
- 多个已验证用例确实需要抽象

### 清晰引用

- 使用 `file.ts:42` 格式引用代码位置
- 使用 `specs/auth/spec.md` 引用规范
- 链接相关变更和 PR

### 能力命名

- 使用“动词-名词”形式，例如 `user-auth`、`payment-capture`
- 每个能力只承担单一目的
- 遵循“10 分钟内可理解”规则
- 如果描述中需要使用“AND”，请拆分能力

### 变更 ID 命名

- 使用简短、描述清晰的 kebab-case，例如 `add-two-factor-auth`
- 优先使用动词前缀：`add-`、`update-`、`remove-`、`refactor-`
- 确保唯一；如果名称已被使用，追加 `-2`、`-3` 等

## 工具选择指南

| 任务 | 工具 | 原因 |
|------|------|------|
| 按模式查找文件 | Glob | 快速模式匹配 |
| 搜索代码内容 | Grep | 针对正则搜索优化 |
| 读取特定文件 | Read | 直接访问文件 |
| 探索未知范围 | Task | 多步骤调查 |

## 错误恢复

### 变更冲突

1. 运行 `openspec list` 查看活动中的变更
2. 检查规范是否重叠
3. 与变更负责人协调
4. 考虑合并提案

### 验证失败

1. 使用 `--strict` 参数运行
2. 检查 JSON 输出中的详细信息
3. 验证规范文件格式
4. 确保场景格式正确

### 缺少上下文

1. 首先阅读 `project.md`
2. 检查相关规范
3. 查看最近的归档
4. 请求澄清

## 快速参考

### 阶段标识

- `changes/`——已提议、尚未构建
- `specs/`——已经构建并部署
- `archive/`——已完成的变更

### 文件用途

- `proposal.md`——为什么改、改什么
- `tasks.md`——实现步骤
- `design.md`——技术决策
- `spec.md`——需求与行为

### CLI 核心命令

```bash
openspec list              # 当前有哪些工作正在进行？
openspec show [item]       # 查看详情
openspec validate --strict # 内容是否正确？
openspec archive <change-id> [--yes|-y]  # 标记为完成（自动化时添加 --yes）
```

请记住：规范代表事实，变更代表提案。始终保持二者同步。
