#!/usr/bin/env python3
"""dev 端到端验证（不打印任何凭证）：
1) 注册 dev 测试账号 → 会话令牌存本地文件
2) 以会话调 /api/mcp 发授权码（等价于授权页按钮的请求）
3) 真实 server.py auth 监听器接回调 → 换令牌 → save_auth
4) MCP 工具全链：新增/流水/完结/列表/汇总 + 独立回读断言
5) 撤销令牌后应 401
"""
import json
import os
import re
import secrets
import subprocess
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ledger as L

BASE = "https://dev.invest.leyuw.com"
ACCT_FILE = os.path.expanduser("~/.config/invest-ledger-mcp/dev-test-account.json")
EMAIL = "mcp-e2e-20261114@example.com"


def http(method, url, token=None, body=None):
    return L.http_json(method, url, token=token, body=body)


def step(msg):
    print(f"[e2e] {msg}", flush=True)


# ---------- 1. 注册测试账号 ----------
if os.path.exists(ACCT_FILE):
    acct = json.load(open(ACCT_FILE))
    step(f"复用已有测试账号 {acct['email']}")
else:
    password = secrets.token_urlsafe(18)
    status, _, payload = http("POST", f"{BASE}/api/auth/login",
                              body={"email": EMAIL, "password": password, "type": "register"})
    assert status == 200 and payload.get("token"), f"注册失败 {status} {payload}"
    acct = {"email": EMAIL, "password": password, "session": payload["token"], "user_id": payload["id"]}
    os.makedirs(os.path.dirname(ACCT_FILE), exist_ok=True)
    with open(ACCT_FILE, "w") as f:
        json.dump(acct, f)
    os.chmod(ACCT_FILE, 0o600)
    step(f"注册成功 {EMAIL}")

session = acct["session"]

# 会话可能过期则重新登录
status, _, _ = http("GET", f"{BASE}/api/mcp?action=me", token=session)
if status == 401:
    status, _, payload = http("POST", f"{BASE}/api/auth/login",
                              body={"email": acct["email"], "password": acct["password"], "type": "login"})
    assert status == 200 and payload.get("token"), f"重新登录失败 {status} {payload}"
    session = payload["token"]
    acct["session"] = session
    json.dump(acct, open(ACCT_FILE, "w"))
    step("会话已刷新")

status, _, me = http("GET", f"{BASE}/api/mcp?action=me", token=session)
assert status == 200 and me.get("email") == acct["email"], f"me 校验失败 {status} {me}"
step("授权页 me 接口 OK（会话有效）")

# 重置测试账本（一次性测试账号，保证可重复运行）
status, headers, _ = http("GET", f"{BASE}/api/investments", token=session)
rev0 = int(headers.get("X-Ledger-Rev") or 0)
status, _, payload = http("POST", f"{BASE}/api/sync", token=session, body={"data": [], "baseRev": rev0})
assert status == 200, f"重置账本失败 {status} {payload}"
step("测试账本已重置为空")

# ---------- 2+3. 真实 auth 流程：起监听 → 发码 → 回调 → 换令牌 ----------
env = dict(os.environ, BROWSER="/bin/true")
proc = subprocess.Popen(
    [os.path.join(os.path.dirname(os.path.abspath(__file__)), ".venv/bin/python"),
     os.path.join(os.path.dirname(os.path.abspath(__file__)), "server.py"),
     "auth", "--url", BASE, "--name", "MCP 端到端验证"],
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)

auth_url = None
deadline = time.time() + 30
buf = ""
while time.time() < deadline:
    line = proc.stdout.readline()
    if not line:
        break
    buf += line
    m = re.search(r"(https://\S*mcp-authorize\.html\S*)", line)
    if m:
        auth_url = m.group(1)
        break
assert auth_url, f"未拿到授权 URL，输出：{buf}"
q = dict(p.split("=", 1) for p in auth_url.split("?", 1)[1].split("&"))
from urllib.parse import unquote
redirect_uri = unquote(q["redirect_uri"])
state = q["state"]
step(f"auth 监听已起，回调 {redirect_uri}")

status, _, payload = http("POST", f"{BASE}/api/mcp", token=session,
                          body={"action": "code", "name": "MCP 端到端验证", "redirect_uri": redirect_uri})
assert status == 200 and payload.get("code"), f"发码失败 {status} {payload}"
code = payload["code"]
step("授权码已生成（等价于网页点授权）")

cb = f"{redirect_uri}?code={code}&state={state}"
with urllib.request.urlopen(cb, timeout=15) as resp:
    assert resp.status == 200
out, _ = proc.communicate(timeout=60)
assert "授权成功" in out, f"auth 流程未成功：{out}"
step("auth 完成：令牌已自动保存")

auth = L.load_auth()
assert auth["token"].startswith("slmcp_") and auth["email"] == acct["email"], "auth.json 内容异常"
step("auth.json 校验 OK")

# ---------- 4. MCP 工具全链 ----------
import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


def parse(result):
    return json.loads(result.content[0].text)


async def main():
    here = os.path.dirname(os.path.abspath(__file__))
    params = StdioServerParameters(command=os.path.join(here, ".venv/bin/python"),
                                   args=[os.path.join(here, "server.py")], cwd=here,
                                   env=dict(os.environ))
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as s:
            await s.initialize()

            r = parse(await s.call_tool("ledger_auth_status", {}))
            assert r["connected"] and r["records"] == 0, f"auth_status {r}"
            step("MCP auth_status OK（空账本）")

            r = parse(await s.call_tool("ledger_add_record", {
                "name": "MCP验证-转债", "principal": 1000, "deposit_date": "2026-10-29",
                "buy_price": 100, "buy_quantity": 10, "notes": "e2e"}))
            assert "error" not in r, r
            bond_id = r["created"]["id"]
            assert r["created"]["currentQuantity"] == 10, r
            step("新增转债记录 OK（数量 10）")

            r = parse(await s.call_tool("ledger_add_record", {
                "name": "MCP验证-银行理财", "principal": 2000, "deposit_date": "2026-11-10",
                "notes": "购于中国银行"}))
            assert "error" not in r, r
            bank_id = r["created"]["id"]
            assert r["created"]["currentPrincipal"] == 2000, r
            step("新增银行理财 OK（只记金额）")

            r = parse(await s.call_tool("ledger_add_transaction", {
                "record": bank_id, "tx_type": "Interest", "date": "2026-11-12", "amount": 12.5}))
            assert "error" not in r, r
            assert r["record"]["totalRealizedProfit"] == 12.5, r
            step("追加利息流水 OK（已实现 12.5）")

            r = parse(await s.call_tool("ledger_close_record", {
                "record": bond_id, "sell_date": "2026-11-13",
                "sell_price": 136.001, "sell_quantity": 10, "fee": 0.34}))
            assert "error" not in r, r
            c = r["closed"]
            assert c["totalRealizedProfit"] == 359.67, c
            assert c["status"] == "已完结" and c["withdrawalDate"] == "2026-11-14", c
            assert c["currentReturn"] == 0, c
            step("完结转债 OK（收益 359.67，取出日=次日，currentReturn=0）")

            r = parse(await s.call_tool("ledger_close_record", {
                "record": bank_id, "sell_date": "2026-12-01", "sell_amount": 2000}))
            assert "error" not in r, r
            assert r["closed"]["totalRealizedProfit"] == 12.5, r
            step("完结银行理财 OK（本金原额赎回，收益只认利息 12.5）")

            r = parse(await s.call_tool("ledger_summary", {}))
            cny = [x for x in r["currencies"] if x["currency"] == "CNY"][0]
            assert cny["completed_count"] == 2 and cny["completed_profit"] == 372.17, cny
            step(f"汇总 OK（已完结 2 笔，收益 {cny['completed_profit']}）")

            r = parse(await s.call_tool("ledger_list", {"status": "completed"}))
            assert r["count"] == 2, r
            step("列表 OK")


asyncio.run(main())

# ---------- 独立回读（绕过 MCP，直接 API + 令牌）----------
status, headers, records = http("GET", f"{BASE}/api/investments", token=auth["token"])
assert status == 200 and len(records) == 2, f"独立回读异常 {status}"
bond = [x for x in records if x["name"] == "MCP验证-转债"][0]
assert bond["totalRealizedProfit"] == 359.67 and bond["currentReturn"] == 0
assert bond["maturityDate"] == "2026-11-13" and bond["withdrawalDate"] == "2026-11-14"
step("独立回读校验 OK（服务端存储与 MCP 报告一致）")

# ---------- 5. 撤销 ----------
status, _, payload = http("GET", f"{BASE}/api/mcp?action=list", token=session)
assert status == 200 and len(payload["tokens"]) >= 1, payload
for t in payload["tokens"]:
    if not t.get("revoked_at"):
        s2, _, p2 = http("POST", f"{BASE}/api/mcp", token=session, body={"action": "revoke", "id": t["id"]})
        assert s2 == 200 and p2.get("success"), f"撤销失败 {s2} {p2}"
status, _, _ = http("GET", f"{BASE}/api/investments", token=auth["token"])
assert status == 401, f"撤销后令牌应失效，实际 {status}"
step("撤销令牌 OK（撤销后立即 401）")

print("[e2e] ALL PASSED")
