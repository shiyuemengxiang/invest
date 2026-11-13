import pg from 'pg';
import crypto from 'crypto';

// ---- MCP 连接器授权（内联版：Vercel 不打包 api/ 之外的 lib，故内联于此）----
// 流程（与常见连接器一致的网页跳转授权）：
//   1. MCP 客户端打开浏览器到 /mcp-authorize.html（带 redirect_uri=本机回调、state）
//   2. 用户在网页登录后点「授权」→ 页面以会话令牌调 POST /api/mcp {action:'code'}
//      服务端发一次性授权码（10 分钟有效、只可兑换一次）
//   3. 页面跳回 redirect_uri?code=...&state=...
//   4. 客户端 POST /api/mcp {action:'exchange', code} 换取长期 API Token（只显示这一次）
// API Token 以 sha256 哈希入库，可在授权页随时撤销；investments/sync 接口同时认它。

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

interface AuthedUser {
  id: string;
  email: string;
  disabled: boolean;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getBearerToken(request: any): string | null {
  const h = request.headers?.['authorization'] || request.headers?.['Authorization'];
  if (typeof h === 'string' && h.startsWith('Bearer ')) return h.slice(7).trim();
  return null;
}

async function ensureTables(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS api_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'MCP',
      token_hash TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMP,
      revoked_at TIMESTAMP
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS mcp_auth_codes (
      code_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'MCP',
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getSessionUser(client: any, request: any): Promise<AuthedUser | null> {
  const token = getBearerToken(request);
  if (!token) return null;
  const { rows } = await client.query(
    `SELECT s.user_id, u.email, u.disabled
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP`,
    [hashToken(token)]
  );
  if (rows.length === 0) return null;
  return { id: rows[0].user_id, email: rows[0].email, disabled: !!rows[0].disabled };
}

function isLocalRedirect(uri: string): boolean {
  try {
    const u = new URL(uri);
    return u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost');
  } catch {
    return false;
  }
}

export default async function handler(request: any, response: any) {
  const client = await pool.connect();
  try {
    await ensureTables(client);

    const method = request.method || 'GET';
    const query = request.query || {};
    let body: any = {};
    if (method === 'POST') {
      body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body || {});
    }
    const action = String(query.action || body.action || '');

    // ---- 当前登录账号（授权页展示用，需会话）----
    if (action === 'me' && method === 'GET') {
      const user = await getSessionUser(client, request);
      if (!user || user.disabled) return response.status(401).json({ error: 'UNAUTHORIZED' });
      return response.status(200).json({ email: user.email });
    }

    // ---- 发一次性授权码（需会话）----
    if (action === 'code' && method === 'POST') {
      const user = await getSessionUser(client, request);
      if (!user || user.disabled) return response.status(401).json({ error: 'UNAUTHORIZED' });
      const redirectUri = body.redirect_uri ? String(body.redirect_uri) : '';
      if (redirectUri && !isLocalRedirect(redirectUri)) {
        return response.status(400).json({ error: 'INVALID_REDIRECT', message: 'redirect_uri 只允许本机地址（127.0.0.1 / localhost）' });
      }
      const name = String(body.name || 'MCP 客户端').slice(0, 60);
      const code = crypto.randomBytes(24).toString('hex');
      await client.query('DELETE FROM mcp_auth_codes WHERE expires_at < CURRENT_TIMESTAMP').catch(() => {});
      await client.query(
        `INSERT INTO mcp_auth_codes (code_hash, user_id, name, expires_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '10 minutes')`,
        [hashToken(code), user.id, name]
      );
      return response.status(200).json({ code, expires_in: 600 });
    }

    // ---- 授权码换长期 Token（无需会话，码即凭证；一次性）----
    if (action === 'exchange' && method === 'POST') {
      const code = String(body.code || '');
      if (!code) return response.status(400).json({ error: 'CODE_REQUIRED' });
      const codeHash = hashToken(code);
      const { rows } = await client.query(
        `SELECT c.user_id, c.name, u.email, u.disabled
         FROM mcp_auth_codes c JOIN users u ON u.id = c.user_id
         WHERE c.code_hash = $1 AND c.used_at IS NULL AND c.expires_at > CURRENT_TIMESTAMP`,
        [codeHash]
      );
      if (rows.length === 0) return response.status(400).json({ error: 'INVALID_CODE', message: '授权码无效、已使用或已过期，请重新授权' });
      if (rows[0].disabled) return response.status(403).json({ error: 'ACCOUNT_DISABLED' });
      const claimed = await client.query(
        `UPDATE mcp_auth_codes SET used_at = CURRENT_TIMESTAMP WHERE code_hash = $1 AND used_at IS NULL RETURNING user_id`,
        [codeHash]
      );
      if (claimed.rows.length === 0) return response.status(400).json({ error: 'INVALID_CODE', message: '授权码已被使用，请重新授权' });

      const token = 'slmcp_' + crypto.randomBytes(32).toString('hex');
      const id = crypto.randomUUID();
      await client.query(
        `INSERT INTO api_tokens (id, user_id, name, token_hash) VALUES ($1, $2, $3, $4)`,
        [id, rows[0].user_id, rows[0].name, hashToken(token)]
      );
      return response.status(200).json({ token, token_id: id, email: rows[0].email, name: rows[0].name });
    }

    // ---- 列出我的 API Token（需会话）----
    if (action === 'list' && method === 'GET') {
      const user = await getSessionUser(client, request);
      if (!user || user.disabled) return response.status(401).json({ error: 'UNAUTHORIZED' });
      const { rows } = await client.query(
        `SELECT id, name, created_at, last_used_at, revoked_at
         FROM api_tokens WHERE user_id = $1 ORDER BY created_at DESC`,
        [user.id]
      );
      return response.status(200).json({ tokens: rows });
    }

    // ---- 撤销 API Token（需会话）----
    if (action === 'revoke' && method === 'POST') {
      const user = await getSessionUser(client, request);
      if (!user || user.disabled) return response.status(401).json({ error: 'UNAUTHORIZED' });
      const id = String(body.id || '');
      if (!id) return response.status(400).json({ error: 'ID_REQUIRED' });
      const r = await client.query(
        `UPDATE api_tokens SET revoked_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
        [id, user.id]
      );
      if (r.rowCount === 0) return response.status(404).json({ error: 'NOT_FOUND' });
      return response.status(200).json({ success: true });
    }

    return response.status(400).json({ error: 'UNKNOWN_ACTION' });
  } catch (e: any) {
    return response.status(500).json({ error: 'SERVER_ERROR', message: String(e?.message || e) });
  } finally {
    client.release();
  }
}
