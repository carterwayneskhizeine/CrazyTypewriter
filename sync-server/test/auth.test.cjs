const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('verified sessions isolate string IDs and never reuse legacy document identities', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crazy-auth-'));
  process.env.DB_PATH = path.join(dir, 'sync.db');
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const id = req.headers.cookie;
    res.end(JSON.stringify(id === 'session=alice' || id === 'session=bob'
      ? { user: { id: id.replace('session=', 'same-prefix-'), email: `${id}@example.invalid` } }
      : {}));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.AUTH_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  try {
    const { initializeDatabase } = require('../dist/config/database');
    const { resolveSession, validateSession } = require('../dist/middleware/authMiddleware');
    const db = await initializeDatabase();
    db.run("INSERT INTO user_documents (user_id, username) VALUES (1, 'legacy')");
    assert.equal(await resolveSession(), null);
    assert.equal(await resolveSession('forged-cookie'), null);
    let status;
    await validateSession({ headers: { 'x-user-id': '1', 'x-username': 'forged' } }, {
      status(value) { status = value; return this; }, json() {},
    }, () => assert.fail('forged headers must not authenticate'));
    assert.equal(status, 401);
    const alice = await resolveSession('session=alice');
    const bob = await resolveSession('session=bob');
    assert.notEqual(alice.id, 1);
    assert.notEqual(bob.id, alice.id);
    assert.deepEqual(await resolveSession('session=alice'), alice);
    assert.equal(db.exec('SELECT count(*) FROM auth_users')[0].values[0][0], 2);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
