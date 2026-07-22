const crypto = require('crypto');
const pool = require('../config/database');
const { hashPassword } = require('./auth');

const findOrCreateGuestCustomer = async ({ full_name, email, phone, address }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Email is required');

  const [existing] = await pool.query(
    'SELECT id, is_blacklisted FROM customers WHERE LOWER(email) = ?',
    [normalizedEmail]
  );

  if (existing.length) {
    if (existing[0].is_blacklisted) {
      throw new Error('You are not allowed to make bookings');
    }
    await pool.query(
      `UPDATE customers SET full_name = ?, phone = COALESCE(?, phone), address = COALESCE(?, address)
       WHERE id = ?`,
      [full_name, phone || null, address || null, existing[0].id]
    );
    return existing[0].id;
  }

  const passwordHash = await hashPassword(crypto.randomBytes(32).toString('hex'));
  const [result] = await pool.query(
    `INSERT INTO customers (email, password_hash, full_name, phone, address) VALUES (?, ?, ?, ?, ?)`,
    [normalizedEmail, passwordHash, full_name, phone || null, address || null]
  );
  return result.insertId;
};

module.exports = { findOrCreateGuestCustomer };
