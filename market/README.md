# 插件市场 index（示例）

这个目录是给 DSH 的 **Discover / 插件市场** 用的索引，不是 npm 包的一部分。

## 发布顺序

1. 把 `index.example.json` 里的 `REPLACE_WITH_YOUR_NAME` 换成你的 GitHub 用户名；
2. 确认 npm 上已经有对应版本（`0.2.0`）；
3. 把文件改名为 `index.json`，放到任意 HTTPS 静态地址（GitHub Pages 最省事）；
4. 用户侧：
   - 启用可选 bundle `@deepseek-ai/dsh-experimental-plugin-market-bundle`（默认关闭）；
   - 在 Discover / Settings 里加入你的 `index.json` 地址；
   - 就能看到「菜鸟课程」并安装。

索引是**未签名**的：它只是安装入口，最终安装什么由 npm 包自己的 `package.json` 决定。

## 校验

DSH 自带 format 1 校验器 `@deepseek-ai/dsh-plugin-market-index`，生成后可以先跑 `parseMarketIndex`。
