const crypto = require('crypto');
const { HttpError } = require('./errors');

const MAX_ADMIN_FAILURES = 5;
const DEFAULT_ADMIN_LOCK_MINUTES = 30;
const MAX_ADMIN_LOCK_MINUTES = 60;

function lockMsFromConfig(config) {
  const minutes = Number(config.adminLockMinutes);
  const safeMinutes = Number.isFinite(minutes) && minutes > 0
    ? Math.min(MAX_ADMIN_LOCK_MINUTES, Math.max(DEFAULT_ADMIN_LOCK_MINUTES, minutes))
    : DEFAULT_ADMIN_LOCK_MINUTES;
  return safeMinutes * 60 * 1000;
}

function safeEqual(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue || ''));
  const right = Buffer.from(String(rightValue || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createAuth(config) {
  const attempts = new Map();
  const adminLockMs = lockMsFromConfig(config);
  const cooldownMinutes = Math.round(adminLockMs / 60_000);

  function attemptKey(req) {
    const forwarded = req.get('x-forwarded-for') || '';
    return forwarded.split(',')[0].trim() || req.ip || req.socket.remoteAddress || 'unknown';
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

  function lockedDetails(lockedUntil, now) {
    return {
      attemptsRemaining: 0,
      cooldownMinutes,
      lockedUntil: new Date(lockedUntil).toISOString(),
      retryAfterSeconds: Math.max(1, Math.ceil((lockedUntil - now) / 1000)),
    };
  }

  function lockedError(lockedUntil, now) {
    const details = lockedDetails(lockedUntil, now);
    return new HttpError(
      429,
      `Muitas tentativas administrativas. O acesso deste endereço IP foi bloqueado temporariamente por ${details.cooldownMinutes} minuto(s). Tente novamente após ${details.lockedUntil}.`,
      'admin_locked',
      details
    );
  }

  function rejectIfLocked(key, now) {
    const state = currentAttemptState(key, now);
    if (state.lockedUntil && state.lockedUntil > now) {
      throw lockedError(state.lockedUntil, now);
    }
  }

  function registerFailure(key, now) {
    const previous = currentAttemptState(key, now);
    const count = previous.count + 1;
    const attemptsRemaining = Math.max(0, MAX_ADMIN_FAILURES - count);

    if (count >= MAX_ADMIN_FAILURES) {
      const lockedUntil = now + adminLockMs;
      attempts.set(key, { count, lockedUntil });
      throw lockedError(lockedUntil, now);
    }

    attempts.set(key, { count, lockedUntil: 0 });
    throw new HttpError(401, `Acesso administrativo inválido. Confira a credencial criada no instalador ou em backend\\.env.local. ${attemptsRemaining} tentativa(s) restante(s).`, 'admin_required', {
      attemptsRemaining,
    });
  }

  function requireAdmin(req, res, next) {
    try {
      if (!config.adminAccessToken) {
        next(new HttpError(500, 'Credencial administrativa ausente no servidor. Configure ADMIN_ACCESS_TOKEN em backend\\.env.local e reinicie o backend.', 'admin_token_missing'));
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
      if (error.code === 'admin_locked' && error.details.retryAfterSeconds) {
        res.set('Retry-After', String(error.details.retryAfterSeconds));
      }
      next(error);
    }
  }

  return { requireAdmin };
}

module.exports = { createAuth, lockMsFromConfig, safeEqual, MAX_ADMIN_FAILURES };
