# 算法游乐场

**首页，交给你了。** 一个能玩的推荐算法小实验，由陈全（Chen Quan）创作。

[直接试玩 →](https://haimuhaimu.github.io/algorithm-playground/) · [构建与部署状态](https://github.com/haimuhaimu/algorithm-playground/actions/workflows/pages.yml)

An interactive recommendation playground. Tune click preference, diversity, and newcomer exposure, then compare the tradeoffs. Synthetic data only. No account required.

调节点击、多样性和新人机会，让同一批内容排出不一样的首页。这里没有真实平台接口、账号、追踪服务或第三方素材；全部 48 条内容与作者都是虚构的。

## 本地运行

需要 Node.js 24 或更新版本。没有第三方运行依赖，无需安装包。

```sh
git clone https://github.com/haimuhaimu/algorithm-playground.git
cd algorithm-playground
npm start
```

打开 http://127.0.0.1:3040/ 。服务仅监听本机，端口可用 `PORT=3041 npm start` 修改。

```sh
npm run verify
```

此命令执行语法检查、算法/服务/打包测试，再生成 `dist/`。测试会短暂绑定本机随机端口。`dist/` 只有五个运行文件，可放在静态站点的子目录中。

## 在线演示与更新

演示使用 GitHub Pages。提交到 `main` 后，GitHub Actions 先运行完整验证，通过后只部署 `dist/`；Pull Request 只验证，不部署。无需配置第三方服务密钥。

没有应用内账号、分析追踪或内容上传功能。体验状态仅保存在当前页面内存中；刷新后重置。静态托管由 GitHub Pages 提供。

## 试着玩一轮

1. 从「只追点击」开始，看看猫猫如何占据首页。
2. 切到「多看一点」，观察新增的主题与点击预测之间的取舍。
3. 试试「新人上场」，或自己调权重，完成右侧的挑战。
4. 点「少一点」改变模拟口味，展开「为什么推荐它」看分数。
5. 跑一轮对照。修改设置后，上轮结果会保留并标记为旧结果，不会假装是新实验。

## 模型边界

这是透明、确定性的教学模型，不是训练好的推荐系统。

- 点击概率：`0.05 + 0.50 × appeal + 0.36 × interest[topic]`。
- 点击分：`clickWeight / 100 × probability`。
- 多样性分：`diversityWeight / 100 × 0.5 / (1 + 已选同主题数)`。
- 新人分：新作者获得 `newcomerWeight / 100 × 0.45`。
- 每轮从剩余候选中选择总分最高的内容；分数并列按编号排序。三个权重相互独立，不要求总和为 100。
- 喜欢 / 少一点会将相应主题兴趣加 / 减 0.12，限制在 0–1。
- 每组模拟 100 位具有相同兴趣的虚拟访客，各看 6 条内容。每个曝光按点击概率采样；两组共享同一组随机数（LCG，种子 42），所以同一设置必得相同结果。
- 当前规则与保存的对照规则使用同一份当前兴趣。保存对照仅保存权重，不冻结兴趣；已完成结果保存自己的权重、兴趣和指标快照。
- 合成内容中，新作者的吸引力参数被设得稍低，用来暴露模型权衡，**不是关于真实新作者的结论**。内容质量参数独立于点击，但未纳入排序或展示；不应据此推断内容价值。
- 不模拟真实用户差异、平台流量、长期留存或统计显著性。40% / 4 主题 / 2 新人只是游戏挑战阈值。

## 文件

- `core.mjs`：纯算法与实验函数。
- `data.mjs`：合成内容、主题和初始口味。
- `app.mjs`：交互状态与渲染。
- `index.html` / `style.css`：原生、响应式界面，含深浅色与减少动画支持。
- `scripts/`：只提供白名单静态文件的本地服务和打包流程。
- `tests/`：Node 内置测试，无外部测试依赖。

已验证桌面浏览器及响应式窗口模拟，未完成真实手机/原生容器验收。刷新页面会重置会话。

## 素材与发布

文案、数据与程序化卡片封面在本项目中生成，无远程图片、字体或素材请求。虚构名称不指代真实账号。

© 2026 Chen Quan / 陈全。当前未授予额外开源许可，详见 [COPYRIGHT](COPYRIGHT)。欢迎直接使用在线演示；需要复用或分发代码时请联系仓库作者确认授权。
