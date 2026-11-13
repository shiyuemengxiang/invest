# Smart Ledger 智能记账本

多用户投资记账应用：记录每一笔投资的买入、卖出、分红、利息与费用，自动算收益和年化。

- 生产环境：https://invest.leyuw.com
- 开发环境：https://dev.invest.leyuw.com （dev 分支）

## 功能

- **投资记录**：固定收益 / 浮动收益两类产品；流水记账（买入、卖出、分红、利息、费用）；支持 CNY / USD / HKD 多币种
- **收益统计**：组合 XIRR、期间收益（今年至今 / 本月 / 自定义区间）、已落袋与预估利息分开统计；浮动型市值浮盈不计入期间收益
- **行情刷新**：场内证券可按代码自动拉取最新价（yahoo-finance2），浮盈自动更新
- **到期提醒**：到期日历视图；PushPlus 微信推送提醒（每账号独立配置）
- **导入导出**：JSON / Excel / CSV 导出，JSON 导入
- **账号体系**：注册 / 登录（密码 bcrypt 哈希存储、登录与注册限流）、SMTP 邮件找回密码、管理员后台
- **MCP 接口**：可授权 AI 助手（如 WorkBuddy）代为查账、记账，见 [`mcp/`](mcp/) 目录

## 技术栈

- 前端：React 18 + TypeScript + Vite，Recharts 图表，xlsx 导出
- 后端：Vercel Serverless Functions（`api/` 目录，TypeScript）
- 数据库：PostgreSQL（`pg` 直连）
- 部署：Vercel；dev 分支对应开发环境，main 对应生产环境

## 本地运行

```bash
npm install
npm run dev
```

需要配置环境变量（见下表），至少要有可用的 `POSTGRES_URL`。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `POSTGRES_URL` | PostgreSQL 连接串 |
| `ADMIN_EMAIL` | 管理员账号邮箱 |
| `CRON_SECRET` | 定时任务调用 `/api/pushplus?cron=1` 的校验密钥 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | 密码找回邮件的 SMTP 配置 |
| `SMTP_FROM` | 发件人（须与 `SMTP_USER` 一致或不设置） |
| `API_KEY` | 历史 AI 功能遗留，当前无代码调用，可不配 |

## 项目结构

```
├─ src/            前端源码（App、components、utils 计算口径）
├─ api/            Serverless 接口（auth、investments、sync、pushplus、admin、market）
├─ public/         静态页（含 MCP 授权页 mcp-authorize.html）
├─ mcp/            Smart Ledger MCP 本地服务（供 AI 助手接入，独立 Python 项目）
└─ vercel.json     路由配置（/api/mcp 借道 sync 函数分发）
```

## 开发约定

- 日常开发在 **dev** 分支，不建 PR；合并 main 上线生产需单独确认
- Vercel Hobby 每部署限 12 个 Serverless 函数，本项目已满：新增接口不要新建 `api/` 文件，参考 `/api/mcp` 借道 `api/sync.ts` 的 rewrite 分发方式
- 账本写入走带版本号（rev）的乐观锁同步，冲突时以云端为准
