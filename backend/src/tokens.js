const crypto = require('crypto');

function randomToken(length = 32) {
  return crypto.randomBytes(length).toString('base64url');
}

function generateAccessCode(length = 4) {
  const digits = '0123456789';
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += digits[Math.floor(Math.random() * digits.length)];
  }
  return output;
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

module.exports = { randomToken, generateAccessCode, hashValue, addDays };
