# Algorithm Playground：给 AI 的实验工具（本地首版）

这个工具让有本地执行能力的 AI 助手，使用与网页相同的引擎运行、解释和重放一条学习路线。它不是聊天机器人，也不是学习认证。

## 能做什么

- `list`：发现十个网页实验，并区分其中可编程运行的能力。
- `describe learning-route`：读取固定条件、可用动作、边界与 GenAI OS 概念链接。
- `run`：从固定起点重放动作，返回真实计算、每步接受/拒绝状态及下一步可用动作。
- `replay`：重新计算一份实验记录，检查它是否与当前版本引擎一致。

**当前只有 `learning-route` 可编程执行。** 其他十个实验只提供发现和浏览器入口；它不是第十一个新实验，而是现有涂鸦实验的三站学习路线。

## 在有权使用的本地项目中运行

需要 Node.js 24+。没有额外依赖、密钥、模型 API、后台服务或网络请求。

```sh
node scripts/learning-tool.mjs list
node scripts/learning-tool.mjs describe learning-route
printf '%s' '{"actions":[{"action":"train"}]}' | node scripts/learning-tool.mjs run
node scripts/learning-tool.mjs replay < my-learning-receipt.json
```

成功时 stdout 是一个 `{ "ok": true, "data": ... }` JSON 对象。失败时退出码为 1，stdout 返回 `{ "ok": false, "error": ... }`，不打印内部栈。stdin 最多 64 KiB，每次最多 256 个动作；这是计算资源约束，不是安全或学习成功门槛。

`run` 只接受 `{ "actions": [{ "action": "...", "value": ... }] }`。不接受任意代码、URL、文件路径、模型对象或私有浏览器数据。没有取值的动作省略 `value`。使用返回的 `result.availableActions` 继续构造动作；不合阶段的已知动作会记录为 `rejected`，无变化的有效动作会记录为 `no-op`。

上面的单次 `train` 只完成第一站的训练，不等于整条路线完成。AI 应把真实结果交给学习者判断，而不是自动替用户选择所有正确答案后宣告学会。

也可以直接导入原生模块：

```js
import {listLearningTools, describeLearningTool, runLearningRoute, replayLearningReceipt} from './learning-tool.mjs';
const receipt = runLearningRoute([{action:'train'}], {producer:'agent'});
```

## 人和 AI 怎样共用记录

网页学习路线结尾有“生成本轮实验记录”。它记录实际操作、错误预测、重试和步长，不读取自由涂鸦、草稿或 localStorage；生成时不会发送或自动复制。用户可以主动复制 JSON 给自己的 AI；浏览器拒绝剪贴板时，文本框仍可手动选取。

AI 收到记录后应：

1. 先确认 `schemaVersion=1`、`engineVersion=learning-route-v1`，用 `replay` 重算；不相信记录里自称的分数。
2. 只解释实际发生的动作、固定条件和真实结果；保留错误预测与被拒绝的动作，不补造因果。
3. 分开“完成流程”“猜对一次”和“掌握概念”。`producer` 只描述生成渠道，不认证身份。重放一致也不证明某个人实际操作过。
4. 一次只建议改变一个允许的条件；优先让学习者自己预测，再运行。
5. 不把课堂结果当生产模型性能，不把固定新题成绩当现实准确率。

三站模型独立。第二站步长可以为 0.03、0.15 或 0.6；第三站重新以 0.15 学 120 步，固定 16 个新位置不参与训练。不能把新题成绩归因于上一站改了步长。

记录中的计算读数以 12 位有效十进制数字序列化（`numericFormat` 明示），避免不同 JavaScript 运行时的末位浮点差异；原始模型、分类判定和画布不经此舍入。这个精度是交换格式的约定，不是模型可靠性门槛。核验仍逐字段精确比较已序列化记录，不放宽为可随意改分数的误差范围。

## 与 GenAI Learning OS 的分工

Playground 负责动手验证和记录；GenAI OS 负责把概念、公式和产品决策组织起来，已有的课程与 Case SDK 不重复实现。

- [数学零层](https://haimuhaimu.github.io/genai-learning-os/?page=math-primer)：翻译公式符号。
- [梯度下降](https://haimuhaimu.github.io/genai-learning-os/?page=foundation&node=gradient-descent)：对照这一步改变的参数。
- [Transformer Block](https://haimuhaimu.github.io/genai-learning-os/?page=foundation&node=transformer-block)：继续看残差与模块结构，**不声称本三站路线已经演示它**。

这些深链按 GenAI OS main `2fe3c059e29967edd878c58cadb765363ab68261` 源码核验，梯度目标也已通过真实浏览器打开。当前只是概念出口，**GenAI OS 端尚未导入这份收据**；它的现有进度导入 schema 不是实验记录 schema。本工具不把实验完成写成 GenAI OS 学习进度，也不跨应用搬运数据；打开课程时，GenAI OS 自身的“已浏览”记录仍按原站规则处理。

两个 GitHub Pages 项目共享 `haimuhaimu.github.io` origin；不同存储键不构成浏览器隔离。本工具不枚举或读取任何私有存储。把收据主动交给外部 AI 后，内容会离开浏览器，不再受“本地计算”承诺涵盖。

## 当前还没有什么

- 没有远程 HTTP 执行端点、MCP 传输、账号、云端同步或一键接入任意 AI 客户端。静态 manifest 只是发现入口，不会自己执行算法。
- 没有统一包装十个实验，更没有自动评价人的学习能力。
- 这是项目本地工具首版。仓库仍为 `UNLICENSED`，本文件不改变 COPYRIGHT 或授予新的复制、分发许可；正式对外分发前需明确许可。没有把 Playground 核心复制到 Apache-2.0 的 GenAI 仓库。

后续 MCP 只应包装同一套 `describe/run/replay`，不能另写一个与网页结果不同的演示模型。
