# Smart Ledger MCP

让其他 AI 助手（任何支持 MCP 的客户端）通过标准 MCP 协议查询、记账、完结
Smart Ledger（invest.leyuw.com）账本。网站侧提供与常见连接器相同的
**网页跳转授权**：点授权 → 浏览器打开网站授权页 → 登录确认 → 跳回本机自动换取
长期令牌保存，全程不需要把密码或令牌贴给任何助手。

## 组成

| 部分 | 位置 |
|---|---|
| 网站授权接口 | `api/sync.ts` 内的 `handleMcp`（授权码、换令牌、列表、撤销） |
| 网站授权页 | `public/mcp-authorize.html`（登录确认 + 令牌管理/撤销） |
| 账本接口认令牌 | `api/investments.ts`、`api/sync.ts` 已同时接受 API 令牌 |
| MCP 服务（本目录） | `server.py`（工具 + auth 命令）、`ledger.py`（客户端与记账口径） |

注意：Vercel Hobby 套餐每个部署上限 12 个 Serverless 函数，本项目已满额，
所以 `/api/mcp` 不单独建函数文件，而是由 `vercel.json` 的 rewrite 借道
`/api/sync?__mcp=1` 分发。以后给本项目新增接口时同样不要新增 api 文件，
并入现有函数或用 rewrite 借道。（`api/ai.ts` 是 Edge 函数，不占此额度。）

## 授权（每个环境做一次）

```bash
cd ~/workspace/invest-ledger-mcp
.venv/bin/python server.py auth --url https://dev.invest.leyuw.com   # 测试环境
.venv/bin/python server.py auth --url https://invest.leyuw.com       # 生产（上线后）
```

- 会打开浏览器到 `网站/mcp-authorize.html`。未登录会先引导登录，登录后回到
  授权页点「授权并返回客户端」，浏览器跳回本机回环地址，授权码（一次性、
  10 分钟）自动换成长期令牌。
- 令牌保存在 `~/.config/invest-ledger-mcp/auth.json`（权限 0600），只存本机。
  一个授权文件只对应一个站点；切换环境重跑 auth 即可。
- 也可用环境变量 `INVEST_LEDGER_URL` / `INVEST_LEDGER_TOKEN` 覆盖（CI 等场景）。
- 撤销：打开 `网站/mcp-authorize.html`（无参数即管理模式），可查看每个令牌的
  创建/最近使用时间并撤销；撤销立即生效。
- 注意：授权命令必须与打开授权页的浏览器在**同一台机器**（回环回调）。
  令牌等同该账号的完整账本读写权限，请只在自己的设备上授权。

## 接入其他助手（MCP 客户端配置）

```json
{
  "mcpServers": {
    "invest-ledger": {
      "command": "/home/hatch/workspace/invest-ledger-mcp/.venv/bin/python",
      "args": ["/home/hatch/workspace/invest-ledger-mcp/server.py"]
    }
  }
}
```

注意：部分 MCP 客户端启动子进程时只传少量环境变量。若服务所在环境需要
代理才能访问外网，请在配置的 `env` 里把 `HTTPS_PROXY` / `HTTP_PROXY`
（及小写形式）一并传给服务进程，否则会出现连不上或 SSL 错误。

## 工具

| 工具 | 用途 |
|---|---|
| `ledger_auth_status` | 授权状态、站点、账本条数与 rev |
| `ledger_list` | 列表（可按持仓/完结、名称、币种过滤） |
| `ledger_get` | 单条完整记录（含全部流水），按 id 或名称 |
| `ledger_summary` | 按币种汇总：持仓本金、浮盈、已完结收益 |
| `ledger_add_record` | 新增记录 + 首笔买入 |
| `ledger_add_transaction` | 追加流水（买/卖/分红/利息/费用/税） |
| `ledger_close_record` | 整笔完结（卖出/赎回） |
| `ledger_update_record` | 修改记录字段（名称/日期/利率/返利/备注等，只传要改的） |
| `ledger_delete_record` | 删除整条记录（须传 confirm_name 与实际名称一致才执行） |
| `ledger_delete_transaction` | 删除单笔流水（按流水 id，或日期+类型+金额组合定位） |

## 记账口径（已内置，调用方无需操心）

- 所有写入走 GET → 改 → POST（baseRev 乐观锁）→ 回读校验，冲突自动重试，
  多个助手并发也不会互相覆盖；服务端每次同步前自动留快照（30 天）。
- 派生字段（剩余本金、剩余数量、累计成本、已实现收益）由流水重放计算，
  与网站 App 自身逻辑等价，不接受外部手填。
- 完结口径：先记 Sell(+Fee) 流水，再设到期日＝卖出日、取出日＝次日；
  `currentReturn` 强制 0 —— 已完结收益只认流水，杜绝双计。
- 银行理财只记总金额；场内证券（可转债等）才记单价×数量。
- 币种严格分开（CNY/USD/HKD 不混算）。

## 依赖

Python 3.11+，`mcp<2`（已装入本目录 `.venv`）。重建：

```bash
~/workspace/vscode/python3.11/cpython-3.11.13-linux-x86_64-gnu/bin/python3.11 -m venv .venv
.venv/bin/pip install "mcp<2"
```
