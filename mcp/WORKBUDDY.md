# 给 WorkBuddy 用（Windows 本地 stdio）

原理：WorkBuddy 在你电脑上直接启动这个 MCP 服务进程，服务再拿你授权的
令牌访问 Smart Ledger。授权只做一次，和连接器一样是网页跳转登录。

## 1. 装 Python
python.org 下载 Python 3.11+ 安装，安装时勾选 "Add python.exe to PATH"。

## 2. 解压本包，装依赖
在本包目录打开 PowerShell：
    pip install -r requirements.txt

## 3. 授权一次（打开浏览器登录点授权，令牌自动保存）
    py server.py auth --url https://invest.leyuw.com
看到 "授权成功：<你的邮箱>" 即可。令牌保存在
%USERPROFILE%\.config\invest-ledger-mcp\auth.json，只在本机。

## 4. 在 WorkBuddy 里添加
桌面端：插件 → MCP 服务器 → 配置 MCP（或 连接器 → 自定义连接器），
把下面这段合并进 mcpServers（路径改成本包在你电脑上的实际位置）：

{
  "mcpServers": {
    "invest-ledger": {
      "command": "py",
      "args": ["C:\\Users\\你的用户名\\Desktop\\invest-ledger-mcp\\server.py"]
    }
  }
}

保存后回到列表，对这个服务器点「信任」，变绿 ✓ 就是连上了，
能看到 10 个工具：查账本、汇总、新增、记流水、完结、修改、删记录、删流水等。

## 备注
- 换电脑/换环境要重新跑一次第 3 步授权。
- 想停用：打开 https://invest.leyuw.com/mcp-authorize.html 撤销令牌即可。
- 账本是生产数据，记账前建议先用 ledger_list / ledger_get 看清现状。
