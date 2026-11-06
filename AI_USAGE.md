# Algorithm Playground：给 AI 的实验工具（本地首版）

这个工具让有本地执行能力的 AI 助手，使用与网页相同的引擎运行、解释和重放学习路线、像素解码与贝叶斯小课。它不是聊天机器人，也不是学习认证。

## 能做什么

- `list`：发现十个网页实验，并区分其中可编程运行的能力。
- `describe learning-route` / `describe pixel-decode` / `describe bayes-update`：读取各自的固定条件、可用动作与边界。
- `run`：从固定起点重放动作，返回真实计算、每步接受/拒绝状态及下一步可用动作。
- `replay`：重新计算一份实验记录，检查它是否与当前版本引擎一致。

**当前可编程执行的是 `learning-route`、`pixel-decode` 与 `bayes-update`。** 分别对应现有涂鸦三站学习路线、像素邮局字节解码与逐位回放、盲盒探矿中的固定贝叶斯小课；没有因此新增实验，也没有把所有网页玩法都包装成执行接口。

## 在有权使用的本地项目中运行

需要 Node.js 24+。没有额外依赖、密钥、模型 API、后台服务或网络请求。

```sh
node scripts/learning-tool.mjs list
node scripts/learning-tool.mjs describe learning-route
node scripts/learning-tool.mjs describe pixel-decode
printf '%s' '{"actions":[{"action":"train"}]}' | node scripts/learning-tool.mjs run
node scripts/learning-tool.mjs replay < my-learning-receipt.json
```

成功时 stdout 是一个 `{ "ok": true, "data": ... }` JSON 对象。`replay` 的输入是 `data` 里的收据本体，不含外层 `ok/data`；网页生成的 JSON 已是收据本体。失败时退出码为 1，stdout 返回 `{ "ok": false, "error": ... }`，不打印内部栈。stdin（包括 replay 收据）最多 64 KiB；学习路线与贝叶斯小课每次最多 256 个动作，像素解码最多 600 个动作，Agent 三关分别最多 9、8、18 个动作。这些是计算资源约束，不是安全或学习成功门槛。manifest 保留原来的单数 `runnable` 和路线 `maxActions` 字段；`runnables` 分别列出各工具的版本与上限。

原有学习路线的 `run` 请求保持 `{ "actions": [{ "action": "...", "value": ... }] }`，默认仍运行 `learning-route`；`runLearningRoute` 和路线收据格式不变。没有取值的动作省略 `value`。使用返回的 `result.availableActions` 继续构造路线动作；在模型学习路线里，不合阶段的已知动作会记录为 `rejected`，无变化的有效动作会记录为 `no-op`。这些工具都不接受任意代码、URL、文件路径、模型对象或私有浏览器数据。

## 贝叶斯小课：先猜，再加入一条新线索

入口是 `mining.html#bayes-lesson`，不是 30 趟自由探索的日志。`runLearningTool({experimentId:'bayes-update',actions:[]},{producer:'agent'})` 返回当前可用动作；继续把所选动作加入同一个数组重放。动作包括 `guess`、`reveal`、`change-guess`、`update`、`answer`、`reset`，取值和阶段以 `describeLearningTool('bayes-update')` 与 `result.availableActions` 为准，不替学习者选择答案。

`bayes-update-v1` 共用固定 Beta(1,1) 先验、3/5 与 18/30 两份日志，并明示各加入一次空手反馈。记录保留真实初猜、纠错尝试和 reset；`result.evidence` 的前后 counts、alpha/beta、均值和 90% 可信区间由现有小课核心重新计算，不含仅用于画图的 curve。未揭晓的 belief、after、transfer 仍为 null。样本比例不是后验均值；后验均值不是已知真实成功率；区间依赖先验和模型条件，不是保证。

`replayLearningReceipt(receipt)` 对整份记录重算并比较，返回 `{matches:true,authenticatesUser:false,receipt}`。它不认证操作者，不能把 AI 代跑、流程完成或改到正确选项当作本人掌握。网页导出、返回 GenAI OS 与交给外部 AI 都需要显式操作，不读取自由探索、草稿或浏览器存储。

上面的单次 `train` 只完成第一站的训练，不等于整条路线完成。AI 应把真实结果交给学习者判断，而不是自动替用户选择所有正确答案后宣告学会。

也可以直接导入原生模块：

```js
import {listLearningTools, describeLearningTool, runLearningRoute, runLearningTool, replayLearningReceipt} from './learning-tool.mjs';
const receipt = runLearningRoute([{action:'train'}], {producer:'agent'});
```

## 像素邮局：真实字节解码

像素适配器接受编辑器的六个固定预设：嘿姆 `heim`、波比 `bobby`、臭臭 `chouchou-studio`、`heart`、`noise`、`blank`。旧版 `chouchou` 和 `cat` 也保留，原有样例编号与收据仍可重放。它调用网页的同一套编码器、字节解析器和逐位交付计算，不根据百分比猜像素，也不读取自由画纸、草稿或 localStorage。不接受自定义像素、任意字节包或上传文件。

下面用保留的旧版小猫验证重放兼容性：从明确快进到的一格开始，再读取三位。也可以把 `preset` 改成 `heim`、`bobby` 或 `chouchou-studio`；新版臭臭的样例编号为 `pixel-chouchou-studio-v1`，与旧版 `pixel-chouchou-v1` 不同。

```sh
printf '%s' '{"experimentId":"pixel-decode","preset":"cat","mode":"slow-replay","actions":[{"action":"read","value":1},{"action":"read","value":1},{"action":"read","value":1}]}' | node scripts/learning-tool.mjs run
node scripts/learning-tool.mjs replay < my-pixel-receipt.json
```

库调用使用相同请求：

```js
const pixelReceipt = runLearningTool({
  experimentId:'pixel-decode', preset:'cat', mode:'slow-replay',
  actions:[{action:'read', value:1}, {action:'read', value:1}, {action:'read', value:1}]
}, {producer:'agent'});
const verified = replayLearningReceipt(pixelReceipt);
```

`mode` 省略时为 `delivery`，从第 0 位开始；`slow-replay` 与网页一样，明确跳到一个待解码像素的起点。上例的旧版小猫从第 50 位开始，三次读取后的游标是 51、52、53，当前暗号是 `0`、`01`、`011`，已还原格数是 35、35、36。前两位没有提前揭开第 36 格。

允许的像素动作是 `read`（`value` 为 1–528 的整数）、`seek`（0–528 的整数）和没有 `value` 的 `reset`。`read` 最多读取实际剩余位数；`seek` 超过该预设邮包末尾会记录为 `rejected`，游标不变；`reset` 回到所选模式的起点。`seek` 和 `slow-replay` 的快进不等于逐位点击历史，也不说明学习者亲自读过跳过的部分。

像素收据的 `engineVersion` 为 `pixel-decode-v1`，`numericFormat` 为 `integer-bits`；`stepFormat` 明示紧凑步骤元组 `[status, sentBits, decodedCount, optionalReason]`。`result.evidence` 给出当前游标、完整暗号才出现的像素、实际编码树／载荷／补零开销，以及真实字节解析条目。逐字段重放核验会拒绝篡改的动作、游标、像素和步骤状态；不是相信收据自报的结果。

必须区分 `result.allPixelsDecoded` 与 `result.packetComplete`：旧版小猫第 428 位时 256 格已还原，还需收到最后 4 位补零，到第 432 位邮包才完整。它不是证明现实网络已送达。杂色预设是 66 B，大于原始四颜色像素的 64 B；无损不等于任何图都更小，动画速度也不代表算法性能。

网页的像素回放提供显式“生成记录”。生成时暂停在真实游标，只导出已知固定预设的封存邮包与本轮记录，不拿编辑后的新画纸替代旧信，也不把定位或自动播放当成逐位手动操作。自定义画纸仍可正常玩、寄送和保留草稿，但本首版不导出其内容。生成不会自动复制或上传；主动复制给外部 AI 后，记录才离开本页。收据仍不认证身份、不评估掌握程度、不写入 GenAI OS 进度。

## 人和 AI 怎样共用记录

网页学习路线结尾有“生成本轮实验记录”。它记录实际操作、错误预测、重试和步长，不读取自由涂鸦、草稿或 localStorage；生成时不会发送或自动复制。用户可以主动复制 JSON 给自己的 AI；浏览器拒绝剪贴板时，文本框仍可手动选取。

AI 收到记录后应：

1. 先确认 `schemaVersion=1` 及对应工具版本（`learning-route-v1` 或 `pixel-decode-v1`），用 `replay` 重算；不相信记录里自称的分数或已还原格数。
2. 只解释实际发生的动作、固定条件和真实结果；保留错误预测与被拒绝的动作，不补造因果。
3. 分开“完成流程”“猜对一次”和“掌握概念”。`producer` 只描述生成渠道，不认证身份。重放一致也不证明某个人实际操作过。
4. 一次只建议改变一个允许的条件；优先让学习者自己预测，再运行。
5. 不把课堂结果当生产模型性能，不把固定新题成绩当现实准确率。

三站模型独立。第二站步长可以为 0.03、0.15 或 0.6；第三站重新以 0.15 学 120 步，固定 16 个新位置不参与训练。不能把新题成绩归因于上一站改了步长。

学习路线记录中的计算读数以 12 位有效十进制数字序列化（`numericFormat` 明示），避免不同 JavaScript 运行时的末位浮点差异；原始模型、分类判定和画布不经此舍入。这个精度是交换格式的约定，不是模型可靠性门槛。像素记录使用整数位位置，不使用该浮点格式。核验仍逐字段精确比较已序列化记录，不放宽为可随意改分数的误差范围。

## Agent 实战：显示成功，补给真的到了吗？

`agent-mission.html#mission` 和 CLI 共用 `agent-tool-loop-v1`。每轮从同一张已受理、尚未核验签收的工单开始，最多三次工具调用。动作是 `check`（查签收）、`retry`（启用备用线）、`stop`（停止）与 `restart`（首轮结束后同条件再试）。每次从 `result.availableActions` 选择合法动作；越界或阶段错误会拒绝。重试已受理不算签收；两轮结束也不意味着任务成功。

```sh
node scripts/learning-tool.mjs describe agent-tool-loop
printf '%s' '{"experimentId":"agent-tool-loop","actions":[{"action":"stop"},{"action":"restart"},{"action":"check"},{"action":"retry"},{"action":"check"}]}' | node scripts/learning-tool.mjs run
```

记录包含两轮实际操作、每步观察和最后的签收证据。将返回的 `data` 交给 `replay` 重算核对；它不会执行真实物流、调用模型或认证身份。网页可显式带回 Agent 路线，也可手动导出；外部 AI 的记录只用于对照，不能记成个人实操。

## Agent 实战第二关：新指令来了，旧任务还该继续吗？

`agent-reroute.html#mission` 与 CLI 使用同一个 `agent-reroute-v1` 引擎。依次推进半句字幕和完整改口，再从 `result.availableActions` 选改派或保留旧单。晚到的 `SUP-07` 签收只属于旧单；只有查到 `SUP-08` 的对应签收，才算确认新目标。也可以带着错误结论或未核验的结局复盘；不要把流程结束当作送达。

```sh
node scripts/learning-tool.mjs describe agent-reroute
printf '%s' '{"experimentId":"agent-reroute","actions":[{"action":"advance"},{"action":"advance"},{"action":"reroute"},{"action":"advance"},{"action":"verify-new"}]}' | node scripts/learning-tool.mjs run
```

案例的字幕、时序和回执均为固定模拟，不采集麦克风、不调用外部模型。`replay` 重算操作和对应证据，不认证身份。从 GenAI OS 发起可直接带回，也可导出 JSON 后手动导入。完整的网页实操记录需先重放核对，再由学习者明确确认保存；不自动修改其他学习记录。

## Agent 实战第三关：只留三帧，你会留下哪一帧？

`agent-frames.html#mission` 与 CLI 使用同一个 `agent-frames-v1` 引擎。按 `advance` 推进固定片段，首轮按固定间隔留 3 帧。用 `start-manual` 从同一开头再来，抵达想保留的当前帧时执行一次 `pin`，只替换中间一帧；第一帧和最后一帧保持不变。以 `result.availableActions` 为准，不能跳到未来、事后补选或重复留帧。

`node scripts/learning-tool.mjs describe agent-frames` 查看约束。记录列出每轮实际送入的帧编号、门牌证据和固定规则给出的结论；`replay` 会从动作重算两轮，而不是接受手填结论。没有拍到门牌只表示证据不足，不表示禁止卸货。案例只用固定画面和字幕，不拍摄、不录音、不运行视觉识别或真实放行。

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

后续 MCP 只应包装同一套 `describe/run/replay`，不能另写一个与网页结果不同的演示模型或解码器。
