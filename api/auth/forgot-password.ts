import pg from 'pg';
import nodemailer from 'nodemailer';
import { ensureResetTable } from '../../lib/server-auth';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ---- 忘记密码（阶段五-4a）----
// 邮件重置：SMTP 配置走环境变量（免费方案：163 邮箱 SMTP）
//   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM
// 163 邮箱需在 设置-开启 SMTP 服务并获取"授权码"（不是登录密码）填入 SMTP_PASS。

function getIp(request: any): string {
  const h = request.headers || {};
  const xff = h['x-forwarded-for'] || h['X-Forwarded-For'];
  if (xff) return String(xff).split(',')[0].trim();
  return 'unknown';
}

async function checkRateLimit(client: any, key: string, maxPerHour: number): Promise<boolean> {
  const { rows } = await client.query('SELECT fails, updated_at FROM login_attempts WHERE key = $1', [key]);
  if (rows.length === 0) return false;
  if (new Date(rows[0].updated_at).getTime() < Date.now() - 3600 * 1000) {
    await client.query('DELETE FROM login_attempts WHERE key = $1', [key]);
    return false;
  }
  return (rows[0].fails || 0) >= maxPerHour;
}

async function recordAttempt(client: any, key: string) {
  await client.query(
    `INSERT INTO login_attempts (key, fails, updated_at)
     VALUES ($1, 1, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET fails = login_attempts.fails + 1, updated_at = CURRENT_TIMESTAMP`,
    [key]
  );
}

function getBaseUrl(request: any): string {
  const h = request.headers || {};
  const host = h['x-forwarded-host'] || h['X-Forwarded-Host'] || h['host'] || h['Host'];
  const proto = h['x-forwarded-proto'] || h['X-Forwarded-Proto'] || 'https';
  return host ? `${proto}://${host}` : '';
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const client = await pool.connect();
  try {
    await ensureResetTable(client);

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const emailNorm = String(body?.email || '').trim().toLowerCase();
    if (!emailNorm) {
      return response.status(400).json({ error: 'Missing email' });
    }

    // 限流：同一邮箱每小时 3 次，同一 IP 每小时 10 次
    const ip = getIp(request);
    if (await checkRateLimit(client, `forgot:email:${emailNorm}`, 3) ||
        await checkRateLimit(client, `forgot:ip:${ip}`, 10)) {
      return response.status(429).json({ error: 'TOO_MANY_ATTEMPTS', message: '请求过于频繁，请稍后再试' });
    }
    await recordAttempt(client, `forgot:email:${emailNorm}`);
    await recordAttempt(client, `forgot:ip:${ip}`);

    // 为防枚举：无论邮箱是否存在都返回成功
    const { rows: userRows } = await client.query('SELECT id, email FROM users WHERE email = $1', [emailNorm]);
    if (userRows.length === 0) {
      return response.status(200).json({ success: true });
    }
    const user = userRows[0];

    const transporter = createTransporter();
    if (!transporter) {
      console.error('SMTP not configured');
      return response.status(200).json({ success: true });
    }

    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const id = crypto.randomUUID();
    await client.query(
      `INSERT INTO password_resets (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '30 minutes')`,
      [id, user.id, tokenHash]
    );

    const resetUrl = `${getBaseUrl(request)}/?reset_token=${token}`;
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    await transporter.sendMail({
      from,
      to: user.email,
      subject: 'Smart Ledger 密码重置',
      text: `你在 Smart Ledger 申请了密码重置（30 分钟内有效）：\n\n${resetUrl}\n\n如果不是你本人操作，请忽略此邮件。`,
      html: `<p>你在 Smart Ledger 申请了密码重置（30 分钟内有效）：</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>如果不是你本人操作，请忽略此邮件。</p>`
    });

    return response.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return response.status(200).json({ success: true });
  } finally {
    client.release();
  }
}
