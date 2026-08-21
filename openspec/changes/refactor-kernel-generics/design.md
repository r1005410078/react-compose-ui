# 设计说明

## 为什么是一个类型参数而不是六个

内核用到六个文档相关类型：context、index、event、claimEvent、effect、snapshot。若逐个
做类型参数，`InteractionPlugin<TContext, TIndex, TEvent, TClaimEvent, TEffect, TSnapshot>`
会出现在每个插件、每个会话工厂与每条测试夹具的签名里——泛型化的成本会全部转嫁给消费者。

改用类型级记录（profile）后消费者只写一个参数：

```ts
interface StageKernelProfile extends InteractionKernelProfile {
  readonly context: StageInteractionContext
  readonly index: StageSceneIndex
  readonly event: StageInteractionEvent
  readonly claimEvent: StagePointerDownEvent
  readonly effect: StageInteractionEffect
  readonly snapshot: StageInteractionSnapshot
}
```

新增一个内核类型时改的是 profile 定义，而不是每一处签名。

## 为什么 claimEvent 是 profile 成员而不是推导

现有定义把 claim 的事件硬编码成 `Extract<StageInteractionEvent, { type: 'pointer.down' }>`。
若泛型版本沿用这个推导，字符串字面量 `'pointer.down'` 就留在了内核里——而 CAD 的命令由
键盘启动（`L↵`），claim 的触发事件不是指针按下。让 profile 自己声明触发事件，内核就不必
认识任何事件种类名。

代价是一行 profile 成员，收益是内核不再假设输入设备。

## pointerId 保持原样——已知的未解问题，刻意不在本步解决

仲裁器用 `session.pointerId` 判定「这个事件属不属于当前会话」，事件侧则读取可选的
`pointerId`。这是**指针语义泄漏进泛型内核**的唯一一处，泛型 profile 因此要求事件满足
`{ readonly pointerId?: number }`。

不在本步一并抽象成 `sessionKey` 之类的中性概念，理由有两条：

1. **消费者还不存在。** AGENTS.md 明令「不得以未来可能复用为理由提前抽象」。CAD 的会话
   身份该绑什么，要等命令引擎（路线图步骤 5）真写出来才知道——命令由 `L↵` 启动时尚无
   指针，首次点击才产生一个，届时是「会话绑定在首次点击上」还是「绑定在命令调用上」是个
   需要实测的问题，现在设计等于猜。
2. **本步的门槛是零行为变化。** 改名 `pointerId` 会波及 18 个插件与全部测试夹具，把一刀
   低风险的类型重构变成一刀高风险的重命名。

因此本步只如实记下这处泄漏。步骤 5 有了真实消费者之后再决定。

## 为什么不顺手抽成独立包

泛型内核逻辑上已经文档无关，看起来该立刻搬进 `@compose-ui/interaction-kernel`，让 CAD
不必依赖整个 `stage-engine`。不做，理由同样是 AGENTS.md：「只有已经被至少两个第一方包
复用……才能上移」。今天只有一个消费者。

而且推迟的成本很低：这个仓库刚做过两轮目录级搬迁（`stage-surface`、`stage-engine`），
文件移动 + 导入重写是走过两遍的机械操作。等步骤 4 CAD 真的要用时再抽，那时抽取由规则
背书而不是由预测背书。

**但本步要为那次抽取扫清障碍**：三个泛型文件对 stage 专有类型的 import 必须清零，并由
`dependency-boundary.test.ts` 守住。否则「逻辑无关但类型有关」这件事会随着后续修改悄悄
复发，等到步骤 4 才发现就是一次考古。

## Stage 绑定单独成文件

`stage-kernel-profile.ts` 承载 profile 绑定与七个别名。放进 `kernel-types.ts` 会让后者
重新 import stage 类型，上面那条守卫就无从谈起——**边界从声明变成结构**，才守得住。
