export function isAuthorized(req, token) {
  const header = req.headers.authorization || '';
  const [scheme, value] = header.split(' ');
  return scheme === 'Bearer' && value && value === token;
}

export function requireBearer(req, res, token) {
  if (!isAuthorized(req, token)) {
    sendJson(res, 401, { error: 'unauthorized' });
    return false;
  }
  return true;
}

export function sendJson(res, statusCode, payload) {
  const data = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data)
  });
  res.end(data);
}
