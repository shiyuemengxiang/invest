#!/usr/bin/env python3
"""Smart Ledger MCP 服务（stdio）。

其他 AI 助手通过 MCP 调用本服务即可查询/维护 Smart Ledger 账本。
首次使用先授权（和常见连接器一样的网页跳转流程）：

    .venv/bin/python server.py auth --url https://dev.invest.leyuw.com

会打开浏览器到网站的 /mcp-authorize.html：登录 → 点「授权」→ 浏览器跳回本机，
授权码自动换成长期令牌并保存在 ~/.config/invest-ledger-mcp/auth.json（0600）。
令牌可在授权页随时撤销。授权必须在与浏览器同一台机器上运行。
"""
import argparse
import json
import secrets
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, __file__.rsplit("/", 1)[0])
import ledger as L
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("invest-ledger")


def _client():
    return L.LedgerClient()


def _err(e):
    return {"error": str(e)}


# ---------------- 查询 ----------------

@mcp.tool()
def ledger_auth_status() -> dict:
    """查看当前授权状态（连接的网站、账号、账本条数）。未授权会返回提示。"""
    try:
        c = _client()
        records, rev = c.get_ledger()
        return {
            "connected": True,
            "base_url": c.base_url,
            "email": c.email,
            "records": len(records),
            "rev": rev,
        }
    except Exception as e:
        return {"connected": False, "error": str(e)}


@mcp.tool()
def ledger_list(status: str = "all", name_contains: str = "", currency: str = "") -> dict:
    """列出账本记录（精简视图）。

    status: all / open（持仓中）/ completed（已完结）；name_contains 按名称过滤；currency 如 CNY/USD/HKD。
    """
    try:
        c = _client()
        records, rev = c.get_ledger()
        out = []
        for r in records:
            done = L.is_completed(r)
            if status == "open" and done:
                continue
            if status == "completed" and not done:
                continue
            if name_contains and name_contains not in str(r.get("name", "")):
                continue
            if currency and r.get("currency") != currency:
                continue
            out.append(L.record_brief(r))
        return {"rev": rev, "count": len(out), "records": out}
    except Exception as e:
        return _err(e)


@mcp.tool()
def ledger_get(record: str) -> dict:
    """取一条记录的完整数据（含全部流水）。record 传记录 id 或名称。"""
    try:
        c = _client()
        records, rev = c.get_ledger()
        r = L.find_record(records, record)
        return {"rev": rev, "record": r}
    except Exception as e:
        return _err(e)


@mcp.tool()
def ledger_summary() -> dict:
    """按币种汇总：持仓笔数/在仓本金/持仓浮盈，已完结笔数/已实现收益（流水口径）。

    已完结收益口径与网站一致：流水收益非 0 时只认流水；为 0 时浮动型认手工落袋值。
    固收型无流水收益时按公式利息（单笔买入整段计息）估算并单独标注。
    """
    try:
        c = _client()
        records, _ = c.get_ledger()
        by_ccy = {}
        for r in records:
            ccy = r.get("currency") or "CNY"
            s = by_ccy.setdefault(ccy, {
                "currency": ccy, "open_count": 0, "open_principal": 0.0,
                "floating_pnl": 0.0, "completed_count": 0, "completed_profit": 0.0,
                "fixed_formula_interest_est": 0.0,
            })
            if not L.is_completed(r):
                s["open_count"] += 1
                s["open_principal"] += float(r.get("currentPrincipal") or 0)
                s["floating_pnl"] += float(r.get("currentReturn") or 0)
            else:
                s["completed_count"] += 1
                realized = float(r.get("totalRealizedProfit") or 0)
                if realized != 0:
                    s["completed_profit"] += realized
                elif r.get("type") == "Floating":
                    s["completed_profit"] += float(r.get("currentReturn") or 0)
                else:
                    s["fixed_formula_interest_est"] += _fixed_formula_interest(r)
        for s in by_ccy.values():
            for k in ("open_principal", "floating_pnl", "completed_profit", "fixed_formula_interest_est"):
                s[k] = round(s[k], 2)
        return {"currencies": list(by_ccy.values())}
    except Exception as e:
        return _err(e)


def _fixed_formula_interest(item):
    """固收公式利息（简化：单笔 Buy 整段、计息到到期日封顶、/365）。多笔买入返回 0（不估算）。"""
    from datetime import datetime
    buys = [t for t in (item.get("transactions") or []) if t.get("type") == "Buy"]
    rate = float(item.get("expectedRate") or 0)
    if len(buys) != 1 or rate <= 0:
        return 0.0
    try:
        start = datetime.strptime(str(item.get("depositDate"))[:10], "%Y-%m-%d").date()
        end_raw = item.get("maturityDate") or item.get("withdrawalDate")
        if not end_raw:
            return 0.0
        end = datetime.strptime(str(end_raw)[:10], "%Y-%m-%d").date()
    except Exception:
        return 0.0
    days = (end - start).days
    if days <= 0:
        return 0.0
    basis = 360 if str(item.get("interestBasis")) == "360" else 365
    return float(buys[0].get("amount") or 0) * (rate / 100.0) * days / basis


# ---------------- 记账 ----------------

@mcp.tool()
def ledger_add_record(name: str, principal: float, deposit_date: str,
                      type: str = "Floating", category: str = "Fixed",
                      currency: str = "CNY", symbol: str = "", notes: str = "",
                      maturity_date: str = "", expected_rate: float = 0,
                      buy_price: float = 0, buy_quantity: float = 0,
                      rebate: float = 0) -> dict:
    """新增一条记录并记一笔买入。

    银行理财只传 principal 总金额即可（不要传 buy_price/buy_quantity）；
    场内证券（如可转债，100 元/张）才传 buy_price 与 buy_quantity。
    deposit_date 格式 YYYY-MM-DD。expected_rate 为固收预期年化（%），无则 0。
    """
    try:
        c = _client()
        rec = L.build_record(
            name=name, principal=principal, deposit_date=deposit_date,
            type_=type, category=category, currency=currency, symbol=symbol,
            notes=notes, maturity_date=maturity_date,
            expected_rate=(expected_rate if expected_rate else None),
            buy_price=(buy_price if buy_price else None),
            buy_quantity=(buy_quantity if buy_quantity else None),
            rebate=rebate,
        )

        def mut(records):
            records.append(rec)

        verified, rev = c.mutate(mut)
        saved = L.find_record(verified, rec["id"])
        return {"rev": rev, "created": L.record_brief(saved)}
    except Exception as e:
        return _err(e)


@mcp.tool()
def ledger_add_transaction(record: str, tx_type: str, date: str, amount: float,
                           price: float = 0, quantity: float = 0, notes: str = "") -> dict:
    """给一条记录追加一笔流水，并按流水自动重算派生字段。

    tx_type: Buy / Sell / Dividend / Interest / Fee / Tax。
    一般性追加用这个；整笔卖出完结请用 ledger_close_record（它处理完结日期口径）。
    """
    if tx_type not in ("Buy", "Sell", "Dividend", "Interest", "Fee", "Tax"):
        return {"error": f"tx_type 无效：{tx_type}"}
    try:
        c = _client()
        tx = L.new_tx(date, tx_type, amount,
                      price=(price if price else None),
                      quantity=(quantity if quantity else None),
                      notes=(notes or None))
        holder = {}

        def mut(records):
            r = L.find_record(records, record)
            r.setdefault("transactions", []).append(tx)
            new = L.recalculate_state(r)
            records[records.index(r)] = new
            holder["id"] = new["id"]

        verified, rev = c.mutate(mut)
        saved = L.find_record(verified, holder["id"])
        return {"rev": rev, "record": L.record_brief(saved)}
    except Exception as e:
        return _err(e)


@mcp.tool()
def ledger_close_record(record: str, sell_date: str, sell_amount: float = 0,
                        sell_price: float = 0, sell_quantity: float = 0,
                        fee: float = 0, withdrawal_date: str = "") -> dict:
    """整笔完结一条持仓（卖出/赎回）。

    口径：先记 Sell(+Fee) 流水再选日期结束——maturityDate=卖出日、withdrawalDate=次日
    （可显式传 withdrawal_date 覆盖）；currentReturn 强制 0，收益只认流水，避免双计。
    金额二选一：银行理财传 sell_amount（到账总额）；场内证券传 sell_price×sell_quantity。
    """
    try:
        c = _client()
        if sell_amount:
            amount, price, qty = float(sell_amount), None, None
        elif sell_price and sell_quantity:
            price, qty = float(sell_price), float(sell_quantity)
            amount = round(price * qty, 2)
        else:
            return {"error": "请传 sell_amount（总金额），或 sell_price + sell_quantity"}
        wd = withdrawal_date or L.next_day(sell_date)
        holder = {}

        def mut(records):
            r = L.find_record(records, record)
            if L.is_completed(r):
                raise L.LedgerError(f"记录已完结：{r.get('name')}")
            txs = r.setdefault("transactions", [])
            txs.append(L.new_tx(sell_date, "Sell", amount, price=price, quantity=qty))
            if fee:
                txs.append(L.new_tx(sell_date, "Fee", float(fee)))
            r["maturityDate"] = sell_date
            r["withdrawalDate"] = wd
            r["currentReturn"] = 0
            new = L.recalculate_state(r)
            # recalculate 不动日期/收益框，这里确保完结字段在重放后仍在
            new["maturityDate"] = sell_date
            new["withdrawalDate"] = wd
            new["currentReturn"] = 0
            records[records.index(r)] = new
            holder["id"] = new["id"]

        verified, rev = c.mutate(mut)
        saved = L.find_record(verified, holder["id"])
        return {"rev": rev, "closed": L.record_brief(saved)}
    except Exception as e:
        return _err(e)


# ---------------- 修改与删除 ----------------

@mcp.tool()
def ledger_update_record(record: str, name: str = None, symbol: str = None,
                         category: str = None, type: str = None, currency: str = None,
                         deposit_date: str = None, maturity_date: str = None,
                         withdrawal_date: str = None, expected_rate: float = None,
                         interest_basis: str = None, rebate: float = None,
                         is_rebate_received: bool = None, notes: str = None,
                         current_return: float = None) -> dict:
    """修改一条记录的基本字段（只传要改的，其余保持不变），改完按流水自动重算派生字段。

    日期格式 YYYY-MM-DD；maturity_date/withdrawal_date 传空字符串表示清除
    （清除 withdrawal_date = 把已完结记录重新打开）。改 deposit_date 会同步把最早一笔
    Buy 流水的日期一起改（买入日与首笔买入流水是同一个日期）。
    传 symbol 会同步把 isAutoQuote 设为「有代码即自动行情」。
    current_return 是手工收益框：仅对流水收益为 0 的记录生效（持仓浮盈/完结落袋兜底），
    有 Sell 流水的记录不要填它（收益只认流水，填了会双计或被忽略）。
    """
    try:
        c = _client()
        holder = {}

        def mut(records):
            r = L.find_record(records, record)
            if name is not None:
                r["name"] = name
            if symbol is not None:
                r["symbol"] = symbol
                r["isAutoQuote"] = bool(symbol)
            if category is not None:
                r["category"] = category
            if type is not None:
                if type not in ("Fixed", "Floating"):
                    raise L.LedgerError(f"type 无效：{type}（应为 Fixed / Floating）")
                r["type"] = type
            if currency is not None:
                r["currency"] = currency
            if maturity_date is not None:
                r["maturityDate"] = maturity_date
            if withdrawal_date is not None:
                r["withdrawalDate"] = withdrawal_date or None
            if expected_rate is not None:
                r["expectedRate"] = float(expected_rate)
            if interest_basis is not None:
                r["interestBasis"] = interest_basis
            if rebate is not None:
                r["rebate"] = float(rebate)
            if is_rebate_received is not None:
                r["isRebateReceived"] = bool(is_rebate_received)
            if notes is not None:
                r["notes"] = notes
            if current_return is not None:
                r["currentReturn"] = float(current_return)
            if deposit_date is not None and deposit_date != r.get("depositDate"):
                r["depositDate"] = deposit_date
                buys = [t for t in (r.get("transactions") or []) if t.get("type") == "Buy"]
                if buys:
                    first_buy = min(buys, key=lambda t: str(t.get("date", "")))
                    first_buy["date"] = deposit_date
            # recalculate_state 是 dict 拷贝 + 只覆盖流水派生字段，上面改的字段自动保留
            new = L.recalculate_state(r)
            records[records.index(r)] = new
            holder["id"] = new["id"]

        verified, rev = c.mutate(mut)
        saved = L.find_record(verified, holder["id"])
        return {"rev": rev, "updated": L.record_brief(saved)}
    except Exception as e:
        return _err(e)


@mcp.tool()
def ledger_delete_record(record: str, confirm_name: str) -> dict:
    """删除整条记录（不可恢复，网站会保留同步快照）。

    安全确认：confirm_name 必须与记录的实际名称完全一致，否则拒绝执行并返回实际名称。
    """
    try:
        c = _client()
        records, _ = c.get_ledger()
        target = L.find_record(records, record)
        if confirm_name != target.get("name"):
            return {"error": f"确认名称不符：要删除的记录实际名称是「{target.get('name')}」，"
                             f"请把 confirm_name 传这个名称再执行"}
        holder = {"brief": L.record_brief(target)}

        def mut(recs):
            r = L.find_record(recs, target["id"])
            recs.remove(r)

        verified, rev = c.mutate(mut)
        if any(r.get("id") == target["id"] for r in verified):
            return {"error": "删除后回读仍能找到该记录，删除未生效"}
        return {"rev": rev, "deleted": holder["brief"], "remaining": len(verified)}
    except Exception as e:
        return _err(e)


@mcp.tool()
def ledger_delete_transaction(record: str, transaction_id: str = "",
                              tx_date: str = "", tx_type: str = "", tx_amount: float = 0) -> dict:
    """删除一条记录里的一笔流水，删完按剩余流水自动重算派生字段。

    定位方式二选一：传 transaction_id（ledger_get 里能看到每笔流水的 id）；
    或传 tx_date + tx_type + tx_amount 三者组合定位（必须唯一匹配，多笔相同会拒绝并列出候选）。
    """
    try:
        c = _client()
        holder = {}

        def mut(records):
            r = L.find_record(records, record)
            txs = r.get("transactions") or []
            victim = None
            if transaction_id:
                for t in txs:
                    if t.get("id") == transaction_id:
                        victim = t
                        break
                if victim is None:
                    raise L.LedgerError(f"该记录里找不到流水 id：{transaction_id}")
            else:
                if not (tx_date and tx_type and tx_amount):
                    raise L.LedgerError("请传 transaction_id，或 tx_date + tx_type + tx_amount 组合")
                matches = [t for t in txs
                           if str(t.get("date", ""))[:10] == tx_date
                           and t.get("type") == tx_type
                           and abs(float(t.get("amount") or 0) - float(tx_amount)) < 0.005]
                if not matches:
                    raise L.LedgerError(f"没有匹配 {tx_date} {tx_type} {tx_amount} 的流水")
                if len(matches) > 1:
                    ids = "、".join(str(t.get("id")) for t in matches)
                    raise L.LedgerError(f"匹配到 {len(matches)} 笔相同流水，请改用 transaction_id 指定：{ids}")
                victim = matches[0]
            r["transactions"] = [t for t in txs if t is not victim]
            holder["deleted_tx"] = victim
            new = L.recalculate_state(r)
            records[records.index(r)] = new
            holder["id"] = new["id"]

        verified, rev = c.mutate(mut)
        saved = L.find_record(verified, holder["id"])
        return {"rev": rev, "deleted_tx": holder["deleted_tx"], "record": L.record_brief(saved)}
    except Exception as e:
        return _err(e)


# ---------------- 网页授权（auth 子命令） ----------------

def run_auth(base_url: str, name: str = "Smart Ledger MCP") -> int:
    base_url = base_url.rstrip("/")
    state = secrets.token_hex(8)
    result = {}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            parsed = urlparse(self.path)
            if parsed.path != "/callback":
                self.send_response(404)
                self.end_headers()
                return
            qs = parse_qs(parsed.query)
            result["code"] = (qs.get("code") or [""])[0]
            result["state"] = (qs.get("state") or [""])[0]
            body = ("<html><head><meta charset='utf-8'><title>授权完成</title></head>"
                    "<body style='font-family:sans-serif;text-align:center;padding-top:60px'>"
                    "<h2>授权完成，可以关闭本页</h2><p>令牌已自动保存到本机。</p></body></html>")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(body.encode("utf-8"))
            threading.Thread(target=self.server.shutdown, daemon=True).start()

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    redirect_uri = f"http://127.0.0.1:{port}/callback"
    from urllib.parse import quote
    auth_url = (f"{base_url}/mcp-authorize.html?redirect_uri={quote(redirect_uri, safe='')}"
                f"&state={state}&name={quote(name, safe='')}")
    print("正在打开浏览器到 Smart Ledger 授权页…", flush=True)
    print(f"若没有自动打开，请手动访问：\n{auth_url}", flush=True)
    try:
        webbrowser.open(auth_url)
    except Exception:
        pass
    server.timeout = 300
    try:
        server.handle_request()
        # handle_request 处理一次即返回（含 shutdown 线程），兜底再 serve 一小段
        if "code" not in result:
            server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        print("已取消")
        return 1
    if not result.get("code"):
        print("未收到授权码（超时或被取消）", file=sys.stderr)
        return 1
    if result.get("state") != state:
        print("state 校验失败，已中止", file=sys.stderr)
        return 1
    status, _, payload = L.http_json(
        "POST", f"{base_url}/api/mcp", body={"action": "exchange", "code": result["code"]})
    if status != 200 or not payload.get("token"):
        print(f"换令牌失败 HTTP {status}: {payload}", file=sys.stderr)
        return 1
    saved = L.save_auth(base_url, payload["token"], payload.get("email", ""), payload.get("name", name))
    print(f"授权成功：{saved['email']}（{base_url}），令牌已保存到 {L.AUTH_FILE}")
    return 0


def main():
    parser = argparse.ArgumentParser(description="Smart Ledger MCP")
    sub = parser.add_subparsers(dest="cmd")
    p_auth = sub.add_parser("auth", help="网页跳转授权（打开浏览器登录授权，自动保存令牌）")
    p_auth.add_argument("--url", required=True, help="网站地址，如 https://dev.invest.leyuw.com")
    p_auth.add_argument("--name", default="Smart Ledger MCP", help="令牌名称（显示在授权页的令牌列表）")
    args = parser.parse_args()
    if args.cmd == "auth":
        raise SystemExit(run_auth(args.url, args.name))
    mcp.run()


if __name__ == "__main__":
    main()
