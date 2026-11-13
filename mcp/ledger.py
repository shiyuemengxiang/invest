#!/usr/bin/env python3
"""Smart Ledger 客户端：网页授权令牌 + 账本读写（rev 乐观锁）+ 记账口径。

记账口径（与网站 App 自身行为一致，勿改）：
- 派生字段一律用 recalculateInvestmentState 的等价重放计算，不手填。
- 浮动型完结：先记 Sell(+Fee) 流水，再设 maturityDate=卖出日、withdrawalDate=次日，
  且 currentReturn 必须为 0（收益只认流水 totalRealizedProfit，避免双计）。
- 银行理财只记总金额；场内证券（可转债等）才记单价×数量（可转债 100 元/张）。
"""
import copy
import json
import os
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone

CONFIG_DIR = os.path.join(os.path.expanduser("~"), ".config", "invest-ledger-mcp")
AUTH_FILE = os.path.join(CONFIG_DIR, "auth.json")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 invest-ledger-mcp"


# ---------------- 授权存储 ----------------

def load_auth():
    """优先环境变量，其次本地授权文件（网页授权后写入）。"""
    env_token = os.environ.get("INVEST_LEDGER_TOKEN")
    env_url = os.environ.get("INVEST_LEDGER_URL")
    saved = {}
    if os.path.exists(AUTH_FILE):
        try:
            with open(AUTH_FILE, encoding="utf-8") as f:
                saved = json.load(f)
        except Exception:
            saved = {}
    return {
        "base_url": (env_url or saved.get("base_url") or "").rstrip("/"),
        "token": env_token or saved.get("token") or "",
        "email": saved.get("email") or "",
        "name": saved.get("name") or "",
    }


def save_auth(base_url, token, email, name):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    data = {"base_url": base_url.rstrip("/"), "token": token, "email": email, "name": name}
    tmp = AUTH_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.chmod(tmp, 0o600)
    os.replace(tmp, AUTH_FILE)
    os.chmod(AUTH_FILE, 0o600)
    return data


# ---------------- HTTP ----------------

def http_json(method, url, token=None, body=None, timeout=60):
    headers = {"User-Agent": UA, "Accept": "application/json"}
    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            text = resp.read().decode("utf-8")
            return resp.status, resp.headers, (json.loads(text) if text else {})
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8", "replace")
        try:
            payload = json.loads(text) if text else {}
        except Exception:
            payload = {"raw": text[:500]}
        return e.code, e.headers, payload


class LedgerError(Exception):
    pass


class NotAuthorized(LedgerError):
    pass


class LedgerClient:
    def __init__(self):
        auth = load_auth()
        self.base_url = auth["base_url"]
        self.token = auth["token"]
        self.email = auth["email"]

    def require(self):
        if not self.base_url or not self.token:
            raise NotAuthorized(
                "尚未授权。请先运行： python server.py auth --url <网站地址> "
                "（会打开浏览器到网站授权页，登录点授权后自动保存令牌）"
            )

    def get_ledger(self):
        """返回 (records, rev)。"""
        self.require()
        status, headers, payload = http_json("GET", f"{self.base_url}/api/investments", token=self.token)
        if status == 401:
            raise NotAuthorized("令牌无效或已被撤销，请重新运行 auth 授权")
        if status != 200:
            raise LedgerError(f"拉取账本失败 HTTP {status}: {payload}")
        rev = headers.get("X-Ledger-Rev")
        return payload, (int(rev) if rev is not None else None)

    def sync(self, records, base_rev):
        """POST /api/sync，返回 new_rev；冲突抛 Conflict。"""
        status, headers, payload = http_json(
            "POST", f"{self.base_url}/api/sync", token=self.token,
            body={"data": records, "baseRev": base_rev},
        )
        if status == 401:
            raise NotAuthorized("令牌无效或已被撤销，请重新运行 auth 授权")
        if status == 409:
            raise Conflict(f"账本已被其他端修改（rev 冲突）: {payload}")
        if status != 200:
            raise LedgerError(f"同步失败 HTTP {status}: {payload}")
        rev = payload.get("rev", headers.get("X-Ledger-Rev"))
        return int(rev) if rev is not None else None

    def mutate(self, mutator, retries=3):
        """GET → mutator(records) 改 → POST（带 rev 锁）→ 回读校验。返回 (new_records, new_rev)。"""
        last = None
        for _ in range(retries):
            records, rev = self.get_ledger()
            working = copy.deepcopy(records)
            mutator(working)
            try:
                new_rev = self.sync(working, rev)
            except Conflict as e:
                last = e
                continue
            verified, vrev = self.get_ledger()
            return verified, (vrev if vrev is not None else new_rev)
        raise LedgerError(f"多次重试仍冲突：{last}")


class Conflict(LedgerError):
    pass


# ---------------- 派生字段重放（utils.ts recalculateInvestmentState 等价实现） ----------------

def _r4(x):
    return round(float(x) + 1e-12, 4)


def recalculate_state(item):
    """按流水重放，刷新 currentPrincipal/currentQuantity/totalCost/totalRealizedProfit
    及 principal/quantity 镜像字段；流水按日期升序。"""
    today = datetime.now(timezone.utc).date().isoformat()
    txs = sorted(item.get("transactions") or [], key=lambda t: str(t.get("date", "")))
    cur_principal = 0.0
    cur_qty = 0.0
    total_cost = 0.0
    realized = 0.0
    is_floating = item.get("type") == "Floating"
    for tx in txs:
        amount = float(tx.get("amount") or 0)
        qty = float(tx.get("quantity") or 0)
        tx_date = str(tx.get("date", ""))[:10]
        ttype = tx.get("type")
        if ttype == "Buy":
            cur_principal += amount
            total_cost += amount
            if qty:
                cur_qty += qty
        elif ttype == "Sell":
            if is_floating and cur_qty > 0 and qty > 0:
                avg = cur_principal / cur_qty
                cost_sold = avg * qty
                realized += amount - cost_sold
                cur_principal -= cost_sold
                cur_qty -= qty
            else:
                cur_principal -= amount
                if cur_principal < 0:
                    if is_floating:
                        realized += abs(cur_principal)
                    cur_principal = 0.0
                if qty:
                    cur_qty -= qty
        elif ttype in ("Dividend", "Interest"):
            if tx_date <= today:
                realized += amount
        elif ttype in ("Fee", "Tax"):
            if tx_date <= today:
                realized -= amount
    item = dict(item)
    item["transactions"] = txs
    item["currentPrincipal"] = max(0.0, _r4(cur_principal))
    item["currentQuantity"] = max(0.0, _r4(cur_qty))
    item["totalCost"] = _r4(total_cost)
    item["totalRealizedProfit"] = _r4(realized)
    item["principal"] = item["currentPrincipal"]
    item["quantity"] = item["currentQuantity"]
    return item


# ---------------- 记录查找与摘要 ----------------

def is_completed(item):
    return bool(item.get("withdrawalDate"))


def find_record(records, ref):
    """按 id 精确 → 名称精确 → 名称包含（须唯一）查找。"""
    ref = str(ref)
    for r in records:
        if r.get("id") == ref:
            return r
    exact = [r for r in records if r.get("name") == ref]
    if len(exact) == 1:
        return exact[0]
    if len(exact) > 1:
        raise LedgerError(f"名称「{ref}」有多条记录，请用 id 指定")
    fuzzy = [r for r in records if ref in str(r.get("name", ""))]
    if len(fuzzy) == 1:
        return fuzzy[0]
    if len(fuzzy) > 1:
        names = "、".join(f"{r.get('name')}({r.get('id')})" for r in fuzzy[:8])
        raise LedgerError(f"「{ref}」匹配到多条：{names}，请用 id 或更完整名称")
    raise LedgerError(f"找不到记录：{ref}")


def record_brief(r):
    return {
        "id": r.get("id"),
        "name": r.get("name"),
        "type": r.get("type"),
        "category": r.get("category"),
        "currency": r.get("currency"),
        "status": "已完结" if is_completed(r) else "持仓中",
        "currentPrincipal": r.get("currentPrincipal"),
        "currentQuantity": r.get("currentQuantity"),
        "totalCost": r.get("totalCost"),
        "totalRealizedProfit": r.get("totalRealizedProfit"),
        "currentReturn": r.get("currentReturn") or 0,
        "depositDate": r.get("depositDate"),
        "maturityDate": r.get("maturityDate") or "",
        "withdrawalDate": r.get("withdrawalDate"),
        "symbol": r.get("symbol") or "",
    }


def next_day(iso_date):
    d = datetime.strptime(iso_date[:10], "%Y-%m-%d").date()
    return (d + timedelta(days=1)).isoformat()


def new_tx(date, ttype, amount, price=None, quantity=None, notes=None):
    tx = {"id": str(uuid.uuid4()), "date": date, "type": ttype, "amount": float(amount)}
    if price is not None:
        tx["price"] = float(price)
    if quantity is not None:
        tx["quantity"] = float(quantity)
    if notes:
        tx["notes"] = notes
    return tx


def build_record(name, principal, deposit_date, type_="Floating", category="Fixed",
                 currency="CNY", symbol="", notes="", maturity_date="",
                 expected_rate=None, buy_price=None, buy_quantity=None, rebate=0):
    buy = new_tx(deposit_date, "Buy", principal, price=buy_price, quantity=buy_quantity)
    rec = {
        "id": str(uuid.uuid4()),
        "name": name,
        "symbol": symbol or "",
        "isAutoQuote": bool(symbol),
        "type": type_,
        "category": category,
        "currency": currency,
        "depositDate": deposit_date,
        "maturityDate": maturity_date or "",
        "withdrawalDate": None,
        "rebate": float(rebate or 0),
        "isRebateReceived": False,
        "currentReturn": 0,
        "notes": notes or "",
        "transactions": [buy],
    }
    if expected_rate is not None:
        rec["expectedRate"] = float(expected_rate)
    return recalculate_state(rec)
