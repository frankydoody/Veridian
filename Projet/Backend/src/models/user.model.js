import { query } from '../config/db.js';

export const findUserByEmail = async (email) => {
  const result = await query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0];
};


export const createUser = async (name, email, hashedPassword) => {
  const result = await query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, role, is_active, created_at`,
    [name, email, hashedPassword]
  );
  return result.rows[0];
};

