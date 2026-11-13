#!/usr/bin/env python3
"""新工具验证（dev）：修改记录 / 删除记录 / 删除流水。

复用 e2e 的 dev 测试账号；经 /api/mcp 直接发码换令牌（等价网页授权），
令牌只经环境变量传给 MCP 子进程，不落盘、不打印。
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ledger as L

BASE = "https://dev.invest.leyuw.com"
ACCT_FILE = os.path.expanduser("~/.config/invest-ledger-mcp/dev-test-account.json")


def http(method, url, token=None, body=None):
    return L.http_json(method, url, token=token, body=body)


def step(msg):
    print(f"[test] {msg}", flush=True)


acct = json.load(open(ACCT_FILE))
session = acct["session"]
status, _, _ = http("GET", f"{BASE}/api/mcp?action=me", token=session)
if status == 401:
    status, _, payload = http("POST", f"{BASE}/api/auth/login",
                              body={"email": acct["email"], "password": acct["password"], "type": "login"})
    assert status == 200 and payload.get("token"), f"重新登录失败 {status}"
    session = payload["token"]
    acct["session"] = session
    json.dump(acct, open(ACCT_FILE, "w"))
    step("会话已刷新")

# 重置测试账本
status, headers, _ = http("GET", f"{BASE}/api/investments", token=session)
rev0 = int(headers.get("X-Ledger-Rev") or 0)
status, _, payload = http("POST", f"{BASE}/api/sync", token=session, body={"data": [], "baseRev": rev0})
assert status == 200, f"重置失败 {status} {payload}"
step("测试账本已重置")

# 发码 → 换令牌
status, _, payload = http("POST", f"{BASE}/api/mcp", token=session,
                          body={"action": "code", "name": "新工具验证",
                                "redirect_uri": "http://127.0.0.1:9999/callback"})
assert status == 200 and payload.get("code"), f"发码失败 {status} {payload}"
status, _, payload = http("POST", f"{BASE}/api/mcp",
                          body={"action": "exchange", "code": payload["code"]})
assert status == 200 and payload.get("token"), f"换令牌失败 {status} {payload}"
mcp_token = payload["token"]
step("MCP 令牌已取得")

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


def parse(result):
    return json.loads(result.content[0].text)


async def main():
    here = os.path.dirname(os.path.abspath(__file__))
    env = dict(os.environ, INVEST_LEDGER_URL=BASE, INVEST_LEDGER_TOKEN=mcp_token)
    params = StdioServerParameters(command=os.path.join(here, ".venv/bin/python"),
                                   args=[os.path.join(here, "server.py")], cwd=here, env=env)
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as s:
            await s.initialize()
            tools = await s.list_tools()
            names = {t.name for t in tools.tools}
            assert {"ledger_update_record", "ledger_delete_record", "ledger_delete_transaction"} <= names, names
            step(f"工具列表 OK（共 {len(names)} 个，含 3 个新工具）")

            r = parse(await s.call_tool("ledger_add_record", {
                "name": "新工具验证-固收", "principal": 10000, "deposit_date": "2026-11-01",
                "type": "Fixed", "expected_rate": 3.65}))
            assert "error" not in r, r
            rid = r["created"]["id"]
            step("新增记录 OK")

            # 修改：改名 + 改买入日（首笔 Buy 应同步）+ 返利到账 + 备注
            r = parse(await s.call_tool("ledger_update_record", {
                "record": rid, "name": "新工具验证-固收(改)", "deposit_date": "2026-11-03",
                "rebate": 88, "is_rebate_received": True, "notes": "已修改"}))
            assert "error" not in r, r
            assert r["updated"]["name"] == "新工具验证-固收(改)", r
            assert r["updated"]["depositDate"] == "2026-11-03", r
            step("修改记录 OK（改名/买入日）")

            r = parse(await s.call_tool("ledger_get", {"record": rid}))
            rec = r["record"]
            assert rec["rebate"] == 88 and rec["isRebateReceived"] is True, rec
            buys = [t for t in rec["transactions"] if t["type"] == "Buy"]
            assert len(buys) == 1 and buys[0]["date"] == "2026-11-03", buys
            step("回读校验 OK（返利/到账已改，首笔 Buy 日期已同步）")

            # 追加一笔利息，再用组合条件删掉它
            r = parse(await s.call_tool("ledger_add_transaction", {
                "record": rid, "tx_type": "Interest", "date": "2026-11-10", "amount": 12.5}))
            assert "error" not in r, r
            assert r["record"]["totalRealizedProfit"] == 12.5, r
            r = parse(await s.call_tool("ledger_delete_transaction", {
                "record": rid, "tx_date": "2026-11-10", "tx_type": "Interest", "tx_amount": 12.5}))
            assert "error" not in r, r
            assert r["record"]["totalRealizedProfit"] == 0, r
            step("删除流水（组合定位）OK，派生收益已重算归零")

            # 用 id 删掉 Buy
            buy_id = buys[0]["id"]
            r = parse(await s.call_tool("ledger_delete_transaction", {
                "record": rid, "transaction_id": buy_id}))
            assert "error" not in r, r
            assert r["record"]["currentPrincipal"] == 0 and r["record"]["totalCost"] == 0, r
            step("删除流水（id 定位）OK，本金已重算归零")

            # 删记录：错误确认名应被拒绝
            r = parse(await s.call_tool("ledger_delete_record", {
                "record": rid, "confirm_name": "错的名字"}))
            assert "error" in r, r
            step("删除记录错误确认名被拒绝 OK")

            r = parse(await s.call_tool("ledger_delete_record", {
                "record": rid, "confirm_name": "新工具验证-固收(改)"}))
            assert "error" not in r, r
            assert r["remaining"] == 0, r
            step("删除记录 OK（账本已空）")

    # 独立回读：账本为空
    status, _, payload = http("GET", f"{BASE}/api/investments", token=mcp_token)
    assert status == 200 and payload == [], f"独立回读不为空 {status}"
    step("独立 API 回读 OK")

    # 撤销令牌
    status, _, toks = http("GET", f"{BASE}/api/mcp?action=list", token=session)
    for t in toks.get("tokens", []):
        if not t.get("revoked_at"):
            http("POST", f"{BASE}/api/mcp", token=session, body={"action": "revoke", "id": t["id"]})
    step("测试令牌已撤销")
    print("ALL PASSED")


asyncio.run(main())
