import { createClient } from '@vercel/postgres';
import crypto from 'crypto';
// 生产环境建议安装 bcrypt 加密密码（可选但强烈推荐）
// import bcrypt from 'bcrypt';

export default async function handler(request: any, response: any) {
  // 🔥 核心修复：显式指定池化连接字符串，跳过驱动默认查找逻辑
  const client = createClient({
    connectionString: process.env.POSTGRES_URL as string,
  });

  try {
    // 前置校验：确保环境变量存在
    if (!process.env.POSTGRES_URL) {
      return response.status(500).json({
        error: '环境变量配置错误',
        details: 'POSTGRES_URL 未在 Vercel 中配置'
      });
    }

    await client.connect();
    const { email, password, type } = request.body;

    // 基础参数校验
    if (!email || !password) {
      return response.status(400).json({ error: 'Email and password are required.' });
    }

    // 确保用户表存在（兼容首次部署）
    await client.sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );
    `;

    if (type === 'register') {
      const id = crypto.randomUUID();
      // 生产环境：密码加密存储（替换明文，示例用 bcrypt）
      // const hashedPassword = await bcrypt.hash(password, 10);
      
      try {
        await client.sql`
          INSERT INTO users (id, email, password) 
          VALUES (${id}, ${email}, ${password}) // 生产环境替换为 ${hashedPassword}
        `;
        return response.status(200).json({ id, email });
      } catch (e: any) {
        if (e.code === '23505') { // 邮箱重复（PostgreSQL 唯一约束错误码）
          return response.status(400).json({ error: 'This email is already registered.' });
        }
        throw e; // 其他错误抛到外层 catch
      }
    } else {
      // 登录逻辑
      const { rows } = await client.sql`
        SELECT * FROM users WHERE email = ${email}
      `;

      if (rows.length === 0) {
        return response.status(401).json({ error: 'Invalid email or password.' });
      }

      // 生产环境：密码解密验证
      // const isPasswordValid = await bcrypt.compare(password, rows[0].password);
      // if (!isPasswordValid) {
      //   return response.status(401).json({ error: 'Invalid email or password.' });
      // }

      // 明文验证（仅开发环境，生产务必替换为加密逻辑）
      if (rows[0].password !== password) {
        return response.status(401).json({ error: 'Invalid email or password.' });
      }

      return response.status(200).json({ id: rows[0].id, email: rows[0].email });
    }
  } catch (error: any) {
    console.error("Database Login Error:", error);
    return response.status(500).json({
      error: 'Database operation failed.',
      details: error.message || String(error)
    });
  } finally {
    // 确保连接关闭（即使出错）
    if (client) await client.end();
  }
}