# 一起把算法讲清楚 · Contributing

谢谢你来玩。最有帮助的贡献，往往是把一个人卡住的地方改顺：按钮点了没反馈、结果离操作太远、解释和实际计算对不上，或刷新后丢了记录。

中文和英文 Issue / PR 都欢迎。不会写代码也可以参与，不需要先证明自己懂算法。

## 从哪里开始

- **遇到故障：** [报告功能问题](https://github.com/haimuhaimu/algorithm-playground/issues/new?template=bug-report.yml)。写下页面、操作、预期和实际结果。
- **能玩，但没看懂：** [留下学习卡点](https://github.com/haimuhaimu/algorithm-playground/issues/new?template=learning-friction.yml)。你的直觉是什么、哪一步打断了它，比“体验不好”更容易帮助我们改。
- **有一个改法：** [提改进建议](https://github.com/haimuhaimu/algorithm-playground/issues/new?template=improvement.yml)。先找已有 Issue，避免重复；大改动先讨论，小的错字、坏链接或可复现修复可以直接提 PR。

暂时优先打磨已有实验，不为数量新增关卡。三猫参与具体场景，不把教学变成角色导读，也不替玩家给答案。反馈请就事论事，不责怪提问者或初学者。

## 本地开发

需要 Node.js 24+。无额外依赖、账号或模型密钥；无需 `npm install`。

```sh
git clone https://github.com/haimuhaimu/algorithm-playground.git
cd algorithm-playground
git switch -c fix/short-description
npm start
```

打开 `http://127.0.0.1:3040/`。端口被占用时可以用 `PORT=3041 npm start`。这是源码预览服务，不是 `dist/` 服务。

提交 PR 时用自己的 fork 推送分支，并以本仓库 `main` 为目标；不要向上游 `main` 直接推送。先阅读下方许可边界。

```sh
node --test tests/pathfinding.test.mjs tests/pathfinding-ui.test.mjs
npm run verify
git diff --check
```

第一行只是寻路定向测试示例；换成你改动对应的测试文件。**合并前仍要跑完整 `npm run verify`**：语法检查、全部 Node 测试、静态构建。无需提交生成的 `dist/`。

## 找到代码

| 想改哪里 | 从这里读起 |
| --- | --- |
| 首页与入口 | `index.html`、`home.mjs`、`home-core.mjs`、`home.css` |
| 推荐系统 | `recommendation.html`、`app.mjs`、`core.mjs`、`data.mjs` |
| 其他实验 | 同名 HTML/CSS、算法 `*-core.mjs`、交互模块；详细映射见 [EXPERIMENTS](EXPERIMENTS.md) |
| 学习路线与返程 | `learn.html`、`learning-route*.mjs`、`genai-handoff.mjs` |
| Agent 三关 | `agent-mission*`、`agent-tool.mjs`、`agent-reroute*`、`agent-frames*` |
| AI 执行与回放 | `learning-tool.mjs`、`learning-tool-manifest.json`、`scripts/learning-tool.mjs`；先读 [AI_USAGE](AI_USAGE.md) |
| 测试、预览与部署 | `tests/`、`scripts/serve.mjs`、`scripts/build.mjs`、`.github/workflows/pages.yml` |

运行文件采用白名单。新增需要浏览器加载的文件时，同步更新 `scripts/serve.mjs` 的 `TYPES`、`scripts/build.mjs` 的 `FILES` 与相关交付测试；文档、工作笔记和测试文件不要塞进网站产物。

## 一个好的 PR 应该证明什么

1. **问题可复现。** 写清修改前怎样卡住；修 bug 时先补能暴露问题的回归测试。
2. **结果来自真实计算。** 不用动画、文案或三猫表情代替算法证据。同条件对照要保留同一起点、数据和随机种子。
3. **操作有反馈。** 成功、等待、拒绝和无法保存都要看得见。手机上结果尽量靠近按钮，键盘也能完成关键操作。
4. **已有记录不被误写。** 保留草稿、历史结果、撤销和旧 JSON 的兼容；不要把旧结果当成本轮操作，也不要把 AI 代跑计为本人掌握。
5. **验证有边界。** 说明跑了哪些命令、在哪个浏览器实际试玩；涉及 UI 时检查手机布局、键盘、深色和减少动效。模拟 DOM 测试、响应式窗口与真实手机验收分别写。

只改文档不必做无关游戏演练，但请检查链接、锚点、图片和 GitHub 实际渲染。一次 PR 聚焦一个问题，不顺手改无关实验或批量格式化。

如果用 AI 协助，简述它做了哪部分，以及你亲自复现、核对了什么。不需要晒 token、完整对话或私密提示词；不要提交自己无法解释的生成内容。

## 公开反馈不要带私密内容

Issue、PR、截图和附件都是公开的。优先使用内置示例；不要上传凭证、个人资料、浏览器存储、未脱敏学习记录或别人的素材。截图只截相关页面，JSON 只在确有必要且检查过内容后提供最小复现。

## 许可边界

现有 [COPYRIGHT](COPYRIGHT) 继续适用：这是公开可见的项目，**不是已采用开放许可证的代码库**。反馈和贡献入口不等于任意复用、再分发或商用授权。三猫原画与漫画也保留其权利；新增素材须说明来源和可用范围。第三方字体按 [随附许可](Silkscreen-OFL.txt) 使用。

若你的计划涉及移植、再分发、素材复用或许可证变化，先联系作者确认。不要在 PR 中擅自改许可。个人维护不保证回复或合并时限；需要更多复现材料时，会在对应 Issue / PR 讨论。

## English quick guide

English reports and PRs are welcome. Start with a reproducible bug, confusing feedback, accessibility issue or documentation correction. Use the bilingual [issue forms](https://github.com/haimuhaimu/algorithm-playground/issues/new/choose); discuss larger changes before implementing them.

Use Node.js 24+, create a focused branch in your fork, and run `npm run verify` plus `git diff --check`. No install step or API key is needed. The example targeted test above is for pathfinding; run the relevant tests for your change and the full verification before submitting.

Preserve deterministic comparisons, existing drafts and replay compatibility. For UI changes, distinguish automated tests, browser checks and physical-device checks. State what AI assistance did and what you verified yourself. Keep credentials, private records and unlicensed assets out of public reports.

The current [COPYRIGHT](COPYRIGHT) remains in effect: public visibility and contribution guidance do not grant an open-source license. Ask the author before reusing or redistributing code or artwork.
