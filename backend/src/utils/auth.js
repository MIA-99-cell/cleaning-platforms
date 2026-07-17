const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

const hashPassword = async (password) => bcrypt.hash(password, 12);
const comparePassword = async (password, hash) => bcrypt.compare(password, hash);

const generateToken = (payload) =>
  jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

const verifyToken = (token) => jwt.verify(token, config.jwt.secret);

const generateRandomPassword = (length = 12) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const generateResetToken = () => uuidv4();

const paginate = (page = 1, limit = 20) => {
  const p = Math.max(1, parseInt(page, 10));
  const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
  return { offset: (p - 1) * l, limit: l, page: p };
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  generateRandomPassword,
  generateResetToken,
  paginate,
};
