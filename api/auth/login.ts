import pg from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

// Initialize Pool outside handler for potential reuse in warm environments
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false // Required for Vercel/Neon Postgres
  }
});

// ---- 阶段二：账号安全 ----
const BCRYPT_ROUNDS = 10;
// 登录限流：同一邮箱连续失败 MAX_LOGIN_FAILS 次 → 锁定 LOCK_MINUTES 分钟
const MAX_LOGIN_FAILS = 5;
const LOCK_MINUTES = 15;
// 注册限流：同一 IP 每小时最多注册数
const MAX_REGISTER_PER_IP_PER_HOUR = 10;

function isBcryptHash(s: any): boolean {
  return typeof s === 'string' && /^\$2[aby]\$\d{2}\$/.test(s);
}

async function ensureTables(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT
    );
  `);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB;`);
  // 管理后台用：禁用标记、注册时间
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT FALSE;`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);
  // 限流表（登录失败计数 / 注册计数复用）
  await client.query(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      key TEXT PRIMARY KEY,
      fails INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function getIp(request: any): string {
  const h = request.headers || {};
  const xff = h['x-forwarded-for'] || h['X-Forwarded-For'];
  if (xff) return String(xff).split(',')[0].trim();
  return 'unknown';
}

// 读取用户账本基线（条数/rev/更新时间），供客户端登录时裁决同步方向。
// 失败时返回 null（例如 ledgers 表尚未创建），不阻塞登录。
async function getLedgerMeta(client: any, userId: string) {
  try {
    const { rows } = await client.query(
      `SELECT
         CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) ELSE 0 END AS count,
         rev, updated_at
       FROM ledgers WHERE user_id = $1`,
      [userId]
    );
    if (rows.length === 0) return null;
    return {
      count: Number(rows[0].count) || 0,
      rev: rows[0].rev || 0,
      updatedAt: rows[0].updated_at || null
    };
  } catch (e) {
    return null;
  }
}

async function isLocked(client: any, key: string): Promise<boolean> {
  const { rows } = await client.query('SELECT locked_until FROM login_attempts WHERE key = $1', [key]);
  if (rows.length > 0 && rows[0].locked_until && new Date(rows[0].locked_until) > new Date()) {
    return true;
  }
  return false;
}

async function recordLoginFail(client: any, key: string): Promise<boolean> {
  await client.query(
    `INSERT INTO login_attempts (key, fails, locked_until, updated_at)
     VALUES ($1, 1, NULL, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET fails = login_attempts.fails + 1, updated_at = CURRENT_TIMESTAMP`,
    [key]
  );
  const { rows } = await client.query('SELECT fails FROM login_attempts WHERE key = $1', [key]);
  if ((rows[0]?.fails || 0) >= MAX_LOGIN_FAILS) {
    await client.query(
      `UPDATE login_attempts SET locked_until = CURRENT_TIMESTAMP + ($1 || ' minutes')::interval WHERE key = $2`,
      [String(LOCK_MINUTES), key]
    );
    return true;
  }
  return false;
}

async function clearLoginFails(client: any, key: string) {
  await client.query('DELETE FROM login_attempts WHERE key = $1', [key]);
}

async function checkRegisterLimit(client: any, ip: string): Promise<boolean> {
  const key = `register:${ip}`;
  const { rows } = await client.query('SELECT fails, updated_at FROM login_attempts WHERE key = $1', [key]);
  if (rows.length === 0) return false;
  // 窗口外则清零
  if (new Date(rows[0].updated_at).getTime() < Date.now() - 3600 * 1000) {
    await client.query('DELETE FROM login_attempts WHERE key = $1', [key]);
    return false;
  }
  return (rows[0].fails || 0) >= MAX_REGISTER_PER_IP_PER_HOUR;
}

async function recordRegister(client: any, ip: string) {
  const key = `register:${ip}`;
  await client.query(
    `INSERT INTO login_attempts (key, fails, updated_at)
     VALUES ($1, 1, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET fails = login_attempts.fails + 1, updated_at = CURRENT_TIMESTAMP`,
    [key]
  );
}

export default async function handler(request: any, response: any) {
  const client = await pool.connect();

  try {
    await ensureTables(client);

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const { email, password, type } = body;

    if (!email || !password) {
        return response.status(400).json({ error: 'Email and password are required.' });
    }

    const emailNorm = String(email).trim().toLowerCase();
    const passwordStr = String(password);

    if (type === 'register') {
       // 注册限流（防 spam 灌库）
       const ip = getIp(request);
       if (await checkRegisterLimit(client, ip)) {
         return response.status(429).json({ error: 'TOO_MANY_ATTEMPTS', message: '注册过于频繁，请稍后再试' });
       }
       const id = crypto.randomUUID();
       try {
         const hash = await bcrypt.hash(passwordStr, BCRYPT_ROUNDS);
         await client.query(
           'INSERT INTO users (id, email, password, preferences) VALUES ($1, $2, $3, $4)',
           [id, emailNorm, hash, '{}']
         );
         await recordRegister(client, ip);
         return response.status(200).json({ id, email: emailNorm, preferences: {}, ledgerMeta: null });
       } catch (e: any) {
         if (e.code === '23505') { // Unique violation
            return response.status(400).json({ error: 'EMAIL_EXISTS' });
         }
         throw e;
       }
    } else {
       // ---- 登录 ----
       const lockKey = `login:${emailNorm}`;
       if (await isLocked(client, lockKey)) {
         return response.status(429).json({
           error: 'TOO_MANY_ATTEMPTS',
           message: `密码尝试次数过多，已锁定 ${LOCK_MINUTES} 分钟`
         });
       }

       const { rows: userRows } = await client.query(
         'SELECT id, email, password, preferences, disabled FROM users WHERE email = $1',
         [emailNorm]
       );

       let ok = false;
       const user = userRows[0];
       if (user) {
         if (user.disabled) {
           return response.status(403).json({ error: 'ACCOUNT_DISABLED', message: '账号已被禁用，请联系管理员' });
         }
         if (isBcryptHash(user.password)) {
           ok = await bcrypt.compare(passwordStr, user.password);
         } else {
           // 兼容老明文密码（懒迁移）：比对成功后当场转哈希
           ok = (passwordStr === user.password);
         }
       }

       if (!ok) {
         // 统一错误文案：不区分"账号不存在"与"密码错误"，防邮箱枚举
         const locked = await recordLoginFail(client, lockKey);
         return response.status(locked ? 429 : 401).json({
           error: locked ? 'TOO_MANY_ATTEMPTS' : 'INVALID_CREDENTIALS',
           message: locked ? `密码尝试次数过多，已锁定 ${LOCK_MINUTES} 分钟` : '账号或密码错误'
         });
       }

       await clearLoginFails(client, lockKey);

       // 懒迁移：明文密码转哈希，用户无感
       if (!isBcryptHash(user.password)) {
         try {
           const hash = await bcrypt.hash(passwordStr, BCRYPT_ROUNDS);
           await client.query('UPDATE users SET password = $1 WHERE id = $2', [hash, user.id]);
         } catch (e) {
           console.warn('Password hash migration failed:', e);
         }
       }

       return response.status(200).json({
           id: user.id,
           email: user.email,
           preferences: user.preferences || {},
           ledgerMeta: await getLedgerMeta(client, user.id)
       });
    }
  } catch (error: any) {
    console.error("Database Login Error:", error);
    return response.status(500).json({
        error: 'Database operation failed.',
        details: error.message || String(error)
    });
  } finally {
    client.release();
  }
}
