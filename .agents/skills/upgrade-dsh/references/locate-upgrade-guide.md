# 定位升级文档

## 关键陷阱：目录名不是目标版本

`docs/upgrade-guide/v<T>/` 描述的是**离开 vT、前往下一版**的迁移，**不是"到达 vT"**。

所以"升级到 rc.3"要读的是"从当前声明版本往上、到目标版本之前"的全部 `v<T>` 目录。按目标版本名去找 `v0.2.2-rc.3/` 会读到**不存在的目录**。

本仓库 2026-11 那次升级就空跑过一次：实际有效的目录是 `v0.2.2-rc.1`，而名字看起来该读的那几个都不存在。

## 安装位置

运行时给的是权威路径，不要猜：

```sh
printf '%s\n' "$DSH_INSTALL_DIR"
# 校验确实是 CLI 包
node -p "require(process.env.DSH_INSTALL_DIR + '/package.json').version"
```

## 读索引

索引可能超过一次读取的上限，先打印章节标题与行号，再分段读：

```sh
"$DSH_NODE_EXECUTABLE" -e "
const fs = require('node:fs')
fs.readFileSync(process.argv[1], 'utf8').split(/\r?\n/).forEach((line, i) => {
  if (line.startsWith('## ')) console.log(i + 1, line)
})" "$DSH_INSTALL_DIR/docs/upgrade-guide/README.md"
```

每个 `## v<T>` 段落里有该版本各条目的摘要与中英文路径。

## 读条目

只读命中本插件占用面的条目（清单见 [宿主包与占用面](host-packages.md)）：

- 英文：`docs/upgrade-guide/v<T>/<item>/guide.md`
- 中文：`guide.zh.md`

本仓库文档语言是中文，优先读 `guide.zh.md`，缺失时读英文版。

## 汇报要求

- 列出**读过的**条目与**跳过**的条目及理由。
- 被跳过的条目不能只说"不相关"，要写明"本插件不消费该面"。
- 找不到上述目录或索引时，如实说明缺失，**不要用另一个版本的内容顶替**。
- 官方 `dsh-doc` 技能内有更完整的同类说明（`references/upgrading.md`、`references/locate-docs.md`），但它不保证已安装，故本文件自带最小配方。
