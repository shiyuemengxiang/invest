import crypto from 'crypto';
import pg from 'pg';

// Pushplus 推送提醒：token 管理 + Vercel Cron 到期检查（二合一，省 Function 配额）
// - GET  (Bearer 用户token)：查询配置状态
// - POST (Bearer 用户token)：保存/清除 token，body: { token }
// - GET  ?cron=1 (Bearer CRON_SECRET)：Vercel Cron 定时触发，检查 7 天内到期并推送

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getBearerToken(request: any): string | null {
  const h = request.headers?.['authorization'] || request.headers?.['Authorization'];
  if (typeof h === 'string' && h.startsWith('Bearer ')) return h.slice(7).trim();
  return null;
}

async function getSessionUser(client: any, request: any): Promise<{ id: string } | null> {
  const token = getBearerToken(request);
  if (!token) return null;
  const { rows } = await client.query(
    `SELECT s.user_id FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP AND u.disabled = FALSE`,
    [hashToken(token)]
  );
  if (rows.length === 0) return null;
  return { id: rows[0].user_id };
}

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

async function handleCron(client: any, response: any) {
  const results: any[] = [];
  const { rows: users } = await client.query(`
    SELECT s.user_id AS id, u.email, s.token, s.enabled, s.notified
    FROM pushplus_settings s
    JOIN users u ON u.id = s.user_id
    WHERE s.token IS NOT NULL AND s.token != ''
      AND s.enabled = TRUE
      AND (u.disabled IS NULL OR u.disabled = FALSE)
  `);
  const today = todayStr();
  for (const user of users) {
    const token = user.token;
    let notified: Record<string, string> = {};
    try {
      notified = typeof user.notified === 'string' ? JSON.parse(user.notified) : (user.notified || {});
    } catch { notified = {}; }
    const { rows: ledgers } = await client.query(`SELECT data FROM ledgers WHERE user_id = $1`, [user.id]);
    if (ledgers.length === 0) continue;
    const items = Array.isArray(ledgers[0].data) ? ledgers[0].data : [];
    const maturing: any[] = [];
    for (const item of items) {
      if (!item || item.withdrawalDate) continue;
      const days = daysUntil(item.maturityDate);
      if (days === null || days > 7) continue;
      if (notified[item.id] === today) continue;
      maturing.push({ ...item, daysLeft: days });
    }
    if (maturing.length === 0) {
      results.push({ user: user.email, sent: 0 });
      continue;
    }
    const lines = maturing.map((it) => {
      const d = it.daysLeft;
      const when = d < 0 ? `已逾期 ${-d} 天` : d === 0 ? '今天到期' : `${d} 天后到期`;
      return `• <b>${it.name || '未命名'}</b> ¥${Number(it.currentPrincipal || it.principal || 0).toLocaleString()}（${it.maturityDate}，${when}）`;
    });
    const ok = await sendPushplus(token, `💰 ${maturing.length} 笔投资即将到期`,
      `<p>以下项目即将到期，请及时处理：</p><p>${lines.join('<br>')}</p><p style="color:#999;font-size:12px;">来自 Smart Ledger 到期提醒</p>`);
    if (ok) {
      for (const it of maturing) notified[it.id] = today;
      await client.query(
        `UPDATE pushplus_settings SET notified = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
        [JSON.stringify(notified), user.id]
      );
    }
    results.push({ user: user.email, sent: ok ? maturing.length : 0, ok });
  }
  return response.status(200).json({ ok: true, today, results });
}

export default async function handler(request: any, response: any) {
  const client = getClient();
  try {
    await client.connect();
    // 独立表：避免 JSONB 各种坑
    await client.query(`
      CREATE TABLE IF NOT EXISTS pushplus_settings (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        notified JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Cron 模式：?cron=1 + CRON_SECRET
    const url = new URL(request.url || '', 'http://localhost');
    if (url.searchParams.get('cron') === '1') {
      const auth = request.headers?.['authorization'] || request.headers?.['Authorization'];
      if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return response.status(401).json({ error: 'UNAUTHORIZED' });
      }
      return await handleCron(client, response);
    }

    // 用户模式：Bearer session token
    const user = await getSessionUser(client, request);
    if (!user) return response.status(401).json({ error: 'UNAUTHORIZED' });

    if (request.method === 'GET') {
      const { rows } = await client.query(`SELECT token, enabled FROM pushplus_settings WHERE user_id = $1`, [user.id]);
      const row = rows[0];
      return response.status(200).json({
        configured: !!row?.token,
        enabled: row ? !!row.enabled : true,
        masked: row?.token ? row.token.slice(0, 4) + '****' + row.token.slice(-4) : null,
      });
    }

    if (request.method === 'POST') {
      const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
      const token = (body?.token || '').trim();
      const enabled = body?.enabled;

      if (token) {
        // 保存 token（upsert）
        await client.query(`
          INSERT INTO pushplus_settings (user_id, token, enabled)
          VALUES ($1, $2, TRUE)
          ON CONFLICT (user_id) DO UPDATE SET token = $2, notified = '{}'::jsonb, updated_at = CURRENT_TIMESTAMP
        `, [user.id, token]);
      } else if (body?.token === '') {
        // 显式清空=删除整行
        await client.query(`DELETE FROM pushplus_settings WHERE user_id = $1`, [user.id]);
      }
      if (typeof enabled === 'boolean') {
        await client.query(
          `UPDATE pushplus_settings SET enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
          [enabled, user.id]
        );
      }

      const { rows } = await client.query(`SELECT token, enabled FROM pushplus_settings WHERE user_id = $1`, [user.id]);
      const row = rows[0];
      return response.status(200).json({ ok: true, configured: !!row?.token, enabled: row ? !!row.enabled : true });
    }

    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (e: any) {
    console.error('pushplus error:', e?.message);
    return response.status(500).json({ error: 'INTERNAL_ERROR' });
  } finally {
    await client.end().catch(() => {});
  }
}
