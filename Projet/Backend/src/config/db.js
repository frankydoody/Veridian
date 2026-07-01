import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

export const testConnection = async () => {
  const client = await pool.connect();
  await client.query('SELECT NOW()');
  client.release();
  console.log('✅ Connexion PostgreSQL établie');
};

export const query = (text, params) => pool.query(text, params);

export default pool;