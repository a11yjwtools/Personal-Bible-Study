// ===========================================================================
// Autenticación sencilla por contraseña (APP_PASSWORD) con tokens firmados.
// Los tokens duran 180 días para que un dispositivo que pasa semanas sin
// conexión siga pudiendo sincronizar cuando vuelva a ver el NAS.
// ===========================================================================
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TOKEN_DAYS = parseInt(process.env.TOKEN_DAYS || '180', 10);

function loadSecret(dataDir) {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const secretPath = path.join(dataDir, '.auth-secret');
  try {
    if (fs.existsSync(secretPath)) return fs.readFileSync(secretPath, 'utf8').trim();
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretPath, secret, { encoding: 'utf8', mode: 0o600 });
    return secret;
  } catch (e) {
    return crypto.createHash('sha256').update(String(process.env.APP_PASSWORD || 'estudio')).digest('hex');
  }
}

function createAuth(dataDir) {
  const password = process.env.APP_PASSWORD || '';
  const enabled = password.length > 0;
  const secret = loadSecret(dataDir);
  const failures = new Map(); // ip -> { count, until }

  function sign(payload) {
    return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  }

  function issueToken() {
    const exp = Date.now() + TOKEN_DAYS * 24 * 3600 * 1000;
    const payload = Buffer.from(JSON.stringify({ exp, v: 1 })).toString('base64url');
    return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(exp).toISOString() };
  }

  function verifyToken(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return false;
    const [payload, sig] = token.split('.');
    const expected = sign(payload);
    const a = Buffer.from(sig || '');
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    try {
      const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      return typeof exp === 'number' && exp > Date.now();
    } catch (e) {
      return false;
    }
  }

  function checkPassword(candidate) {
    const a = crypto.createHash('sha256').update(String(candidate || '')).digest();
    const b = crypto.createHash('sha256').update(password).digest();
    return crypto.timingSafeEqual(a, b);
  }

  function clientIp(req) {
    return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
  }

  function loginHandler(req, res) {
    if (!enabled) return res.json({ success: true, token: 'open', authDisabled: true });
    const ip = clientIp(req);
    const f = failures.get(ip);
    if (f && f.until > Date.now()) {
      return res.status(429).json({ success: false, error: 'Demasiados intentos. Espera un minuto.' });
    }
    const { password: candidate } = req.body || {};
    if (!checkPassword(candidate)) {
      const count = (f ? f.count : 0) + 1;
      failures.set(ip, { count, until: count >= 5 ? Date.now() + 60 * 1000 : 0 });
      return res.status(401).json({ success: false, error: 'Contraseña incorrecta.' });
    }
    failures.delete(ip);
    res.json({ success: true, ...issueToken() });
  }

  function middleware(req, res, next) {
    if (!enabled) return next();
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query && req.query.token);
    if (verifyToken(token)) return next();
    res.status(401).json({ success: false, error: 'Sesión caducada o no válida.', authRequired: true });
  }

  return { enabled, loginHandler, middleware, verifyToken };
}

module.exports = { createAuth };
