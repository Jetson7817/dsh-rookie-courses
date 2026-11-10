# 插件市场索引

已发布地址：

```text
https://jetson7817.github.io/dsh-rookie-courses/market/index.json
```

- 格式：DSH plugin market index format 1
- 版本：`0.2.0`
- 源：`git`，固定到 `Jetson7817/dsh-rookie-courses` 的一个 commit
- 图标：相对索引地址的 `../icon.png`

## 用户怎么用

1. 启用 `@deepseek-ai/dsh-experimental-plugin-market-bundle`（默认关闭）；
2. 在 Discover / Settings 里加入上面的索引地址；
3. 找到「菜鸟课程」并安装。

## 发新版本

1. 改 `package.json` 的 `version`；
2. 提交并 push；
3. 把 `market/index.json` 的 `versions[0].version` 和 `source.commit` 改成新提交；
4. commit + push，等 Pages 重建。

索引不签名：它只是安装入口，最终安装什么由仓库里的 `package.json` 决定。
