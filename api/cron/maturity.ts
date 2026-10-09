import pg from 'pg';

// Vercel Cron 定时任务：检查所有用户的到期项目，通过 pushplus 推送微信提醒
// 调用时需带 Header: Authorization: Bearer <CRON_SECRET>
// Vercel Cron 配置见 vercel.json

function getClient(): pg.Client {
  return new pg.Client({ connectionString: process.env.POSTGRES_URL });
}

async function sendPushplus(token: string, title: string, content: string): Promise<boolean> {
  try {
    const res = await fetch('http://www.pushplus.plus/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, title, content, template: 'html' }),
    });
    const data = await res.json();
    return data.code === 200;
  } catch (e) {
    console.error('pushplus send failed:', e);
    return false;
  }
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

export default async function handler(request: any, response: any) {
  // 鉴权：Vercel Cron 会带 Authorization: Bearer <CRON_SECRET>
  const auth = request.headers?.['authorization'] || request.headers?.['Authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return response.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const client = getClient();
  const results: any[] = [];
  try {
    await client.connect();

    // 找出所有配置了 pushplus 的用户
    const { rows: users } = await client.query(`
      SELECT id, email, preferences FROM users
      WHERE preferences->>'pushplus_token' IS NOT NULL
        AND preferences->>'pushplus_token' != ''
        AND (disabled IS NULL OR disabled = FALSE)
    `);

    const today = todayStr();

    for (const user of users) {
      const prefs = user.preferences || {};
      const token = prefs.pushplus_token;
      if (!token) continue;

      // 已发送标记：{ itemId: 'YYYY-MM-DD' }，同一天不重复发
      const notified: Record<string, string> = prefs.pushplus_notified || {};

      // 取用户账本
      const { rows: ledgers } = await client.query(
        `SELECT data FROM ledgers WHERE user_id = $1`,
        [user.id]
      );
      if (ledgers.length === 0) continue;

      const items = Array.isArray(ledgers[0].data) ? ledgers[0].data : [];
      const maturing: any[] = [];

      for (const item of items) {
        if (!item || item.withdrawalDate) continue; // 已取出跳过
        const mDate = item.maturityDate;
        if (!mDate) continue;
        const days = daysUntil(mDate);
        if (days === null) continue;
        // 7天内到期（含已逾期）
        if (days <= 7) {
          // 今天已通知过这笔则跳过
          if (notified[item.id] === today) continue;
          maturing.push({ ...item, daysLeft: days });
        }
      }

      if (maturing.length === 0) {
        results.push({ user: user.email, sent: 0 });
        continue;
      }

      // 构造推送内容
      const lines = maturing.map((it) => {
        const name = it.name || '未命名';
        const amount = it.currentPrincipal || it.principal || 0;
        const d = it.daysLeft;
        const when = d < 0 ? `已逾期 ${-d} 天` : d === 0 ? '今天到期' : `${d} 天后到期`;
        return `• <b>${name}</b> ¥${Number(amount).toLocaleString()}（${it.maturityDate}，${when}）`;
      });

      const title = `💰 ${maturing.length} 笔投资即将到期`;
      const content = `<p>以下项目即将到期，请及时处理：</p><p>${lines.join('<br>')}</p><p style="color:#999;font-size:12px;">来自 Smart Ledger 到期提醒</p>`;

      const ok = await sendPushplus(token, title, content);

      if (ok) {
        // 标记已发送
        for (const it of maturing) notified[it.id] = today;
        prefs.pushplus_notified = notified;
        await client.query(`UPDATE users SET preferences = $1 WHERE id = $2`, [
          JSON.stringify(prefs),
          user.id,
        ]);
      }
      results.push({ user: user.email, sent: ok ? maturing.length : 0, ok });
    }

    return response.status(200).json({ ok: true, today, results });
  } catch (e: any) {
    console.error('cron maturity error:', e?.message);
    return response.status(500).json({ error: 'INTERNAL_ERROR' });
  } finally {
    await client.end().catch(() => {});
  }
}
