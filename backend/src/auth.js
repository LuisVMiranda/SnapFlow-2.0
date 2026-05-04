const crypto = require('crypto');
const { HttpError } = require('./errors');

const MAX_ADMIN_FAILURES = 5;
const ADMIN_LOCK_MS = 15 * 60 * 1000;

function safeEqual(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue || ''));
  const right = Buffer.from(String(rightValue || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createAuth(config) {
  const attempts = new Map();

  function attemptKey(req) {
    const forwarded = req.get('x-forwarded-for') || '';
    return forwarded.split(',')[0].trim() || req.ip || req.socket?.remoteAddress || 'unknown';
  }

  function currentAttemptState(key, now) {
    const state = attempts.get(key);
    if (!state) return { count: 0, lockedUntil: 0 };
    if (state.lockedUntil && state.lockedUntil <= now) {
      attempts.delete(key);
      return { count: 0, lockedUntil: 0 };
    }
    return state;
  }

  function rejectIfLocked(key, now) {
    const state = currentAttemptState(key, now);
    if (state.lockedUntil && state.lockedUntil > now) {
      throw new HttpError(429, 'Muitas tentativas administrativas. Aguarde antes de tentar novamente.', 'admin_locked', {
        attemptsRemaining: 0,
        lockedUntil: new Date(state.lockedUntil).toISOString(),
      });
    }
  }

  function registerFailure(key, now) {
    const previous = currentAttemptState(key, now);
    const count = previous.count + 1;
    const attemptsRemaining = Math.max(0, MAX_ADMIN_FAILURES - count);

    if (count >= MAX_ADMIN_FAILURES) {
      const lockedUntil = now + ADMIN_LOCK_MS;
      attempts.set(key, { count, lockedUntil });
      throw new HttpError(429, 'Muitas tentativas administrativas. Aguarde antes de tentar novamente.', 'admin_locked', {
        attemptsRemaining,
        lockedUntil: new Date(lockedUntil).toISOString(),
      });
    }

    attempts.set(key, { count, lockedUntil: 0 });
    throw new HttpError(401, `Acesso administrativo inválido. ${attemptsRemaining} tentativa(s) restante(s).`, 'admin_required', {
      attemptsRemaining,
    });
  }

  function requireAdmin(req, res, next) {
    try {
      if (!config.adminAccessToken) {
        next(new HttpError(500, 'ADMIN_ACCESS_TOKEN ausente no servidor.', 'admin_token_missing'));
        return;
      }

      const key = attemptKey(req);
      const now = Date.now();
      rejectIfLocked(key, now);

      const header = req.get('authorization') || '';
      const match = header.match(/^Bearer\s+(.+)$/i);
      if (!match || !safeEqual(match[1], config.adminAccessToken)) {
        registerFailure(key, now);
      }

      attempts.delete(key);
      next();
    } catch (error) {
      next(error);
    }
  }

  return { requireAdmin };
}

module.exports = { createAuth, safeEqual, MAX_ADMIN_FAILURES };
