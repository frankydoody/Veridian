import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
// Jamais le mot de passe dans la console (il finirait dans les journaux et les captures d'écran)
console.log(`Base de données : ${process.env.DB_USER}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

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

export const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
