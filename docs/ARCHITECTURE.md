# 目录与发布映射

[项目首页](../README.md) · [贡献指南](../CONTRIBUTING.md) · [实验说明](../EXPERIMENTS.md) · [AI 工具指南](AI_USAGE.md)

源码按功能放在一起，公开网址保持原样。移动源码不改变实验页面、猫图、字体、AI 工具入口或已有书签；`dist/` 是生成的发布目录，不是第二份需要维护的源码。

## 从哪里读起

```text
src/
  home/                    首页、入口与主视觉
    album/                 漫画小相册与集数数据
  experiments/<id>/        每个实验的 HTML、CSS、算法与交互
  agents/
    mission/               第一关：工具回复与真实结果
    reroute/               第二关：改派与迟到回执
    frames/                第三关：三帧证据选择
    shared/                三关共用的末次结果存储
  learning/                学习路线、路线试验与站内往返
  integrations/            AI 工具汇总、manifest、GenAI OS 返程
  shared/                  导航、共用样式、草稿与猫素材索引
assets/
  cats/studio/             三猫角色、动作和导航图
  cats/samples/            分类课猫卡样本
  comics/                  小相册封面与漫画
  previews/                首页实验预览图
  fonts/                   本地字体与随附许可
scripts/                   预览、构建、公开资源映射与 AI CLI
tests/                     按功能组织的 Node 测试
docs/                      架构、AI 用法和文档图片
learning-tool.mjs           旧库调用路径的薄兼容入口
dist/                      自动生成，勿手改或提交
```

`src/experiments/` 下包含 `recommendation`、`pathfinding`、`sand`、`firefly`、`evolution`、`neural`、`mining`、`pixel`、`world-model`、`rsi` 和 `distributions`。通常先读 `*-core.mjs` 了解纯计算，再读页面与交互模块；推荐实验沿用 `core.mjs`、`data.mjs`、`app.mjs` 这些原文件名。

共享目录只收确实跨功能使用的代码。学习路线会调用 neural 的教学模型，AI 工具汇总会调用各案例已有引擎；不为了目录对称复制算法。

## 源码位置不是公开网址

唯一发布白名单是 [`scripts/runtime-files.mjs`](../scripts/runtime-files.mjs)。每个公开文件名明确对应一个源码文件；预览与构建共用这份映射，不递归公开整个 `src/`、`assets/` 或仓库。

| 源码文件 | 站点根目录下的公开路径 |
| --- | --- |
| `src/home/index.html` | `/index.html`（首页也可用 `/`） |
| `src/experiments/pathfinding/pathfinding.html` | `/pathfinding.html` |
| `src/experiments/neural/neural-core.mjs` | `/neural-core.mjs` |
| `src/integrations/learning-tool.mjs` | `/learning-tool.mjs` |
| `src/integrations/learning-tool-manifest.json` | `/learning-tool-manifest.json` |
| `docs/AI_USAGE.md` | `/AI_USAGE.md` |
| `assets/cats/studio/studio-brand-cats.png` | `/studio-brand-cats.png` |
| `assets/fonts/Silkscreen-Regular.ttf` | `/Silkscreen-Regular.ttf` |

表中的 `/` 指站点根目录；线上位于 `https://haimuhaimu.github.io/algorithm-playground/`，本地默认位于 `http://127.0.0.1:3040/`。公开文件名不可重名。新增资源须显式登记并补交付测试；放进某个目录不等于获准发布，原图、工作文件与私有记录不能顺带进入白名单。

### 两类相对路径

- **ESM import 跟随源码目录。** 使用真实相对路径，跨功能时正常写 `../` 或 `../../`。例如 `src/home/home.mjs` 引用 `../experiments/pixel/pixel-core.mjs`。源码可以被 Node 直接导入，不依赖自定义模块加载器。
- **HTML、CSS 与图片字符串跟随公开路径。** 例如页面中的 `./navigation.css`、样式中的 `./Silkscreen-Regular.ttf`、猫素材索引中的 `./studio-heim-idle.png` 都是稳定的公开文件名，不改成源码目录路径。

[`scripts/runtime-content.mjs`](../scripts/runtime-content.mjs) 使用锁定的 `es-module-lexer@3.0.4` 解析模块引用，将源码 ESM 路径映射为 `./<公开文件名>`，保留 `?v=` 等查询参数和片段；不改写算法、普通字符串、HTML、CSS 或图片。预览与构建使用同一转换。未登记的模块引用会报错，不能依赖 npm 包或任意磁盘文件在浏览器中隐式可用。

因此请用 `npm start` 访问页面，不要双击 `src/` 中的 HTML 或使用 `file://`；直接打开无法获得这层公开路径映射。构建不是打包或压缩，浏览器仍加载原生模块，没有第三方浏览器运行依赖。

## 开发与测试

需要 Node.js 24+。在仓库根目录执行：

```sh
npm ci --ignore-scripts
npm start
npm test
npm run verify
```

安装步骤只准备锁定的开发解析器；不需要 API Key 或模型服务。`npm start` 默认在 3040 端口提供源码预览，`PORT=3041 npm start` 可改端口。`npm test` 的 `pretest` 先生成当前 `dist/`，再运行 Node 内置测试。完整 `npm run verify` 覆盖语法、测试和构建。

测试目录与功能对应：

```text
tests/
  experiments/<id>/
  agents/
  home/
  learning/
  integrations/
  shared/
  delivery/
  helpers/
```

`delivery/` 检查发布文件、地址、资源与服务边界，`helpers/` 放 DOM 或文件定位等辅助代码。直接运行定向测试时不会触发 npm 的 `pretest`，因此先构建：

```sh
npm run build && node --test tests/experiments/pathfinding/*.test.mjs
```

改动源文件后重新生成产物，不手工修补 `dist/`。GitHub Pages 只部署通过验证的 `dist/`；源码目录、测试和开发工具不随目录迁移自动上线。

## 保持不变的兼容边界

根目录 [`learning-tool.mjs`](../learning-tool.mjs) 只转出 `src/integrations/learning-tool.mjs` 的库接口，原有 Node 调用可继续使用；网页公开的 `/learning-tool.mjs` 由发布映射直接生成。CLI 仍是 `node scripts/learning-tool.mjs`，`list`、`describe`、`run`、`replay` 的协议见 [AI 工具指南](AI_USAGE.md)。

目录调整不改变页面锚点、版本查询参数、草稿与结果的存储键、收据 schema/engine 版本，或 GenAI OS 的来程参数与返回校验。不要为了整理目录升级这些协议，也不要把源码路径写入实验记录。许可与素材权利仍以 [COPYRIGHT](../COPYRIGHT) 及原有说明为准。
