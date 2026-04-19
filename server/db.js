/**
 * ═══════════════════════════════════════════════════════════════════
 *  Database Module — memory.db (SQLite via sql.js)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  <explanation>
 *  Chain-of-Thought: Connection Setup
 *  ──────────────────────────────────
 *  1. We use `sql.js` (a pure-JS compile of SQLite) because it runs
 *     everywhere Node.js runs — no native binaries, no C toolchain
 *     required. This is critical for VS Code terminal compatibility
 *     on Windows, macOS, and Linux.
 *
 *  2. sql.js operates entirely in-memory. To persist data, we
 *     manually export the database to a file (`memory.db`) after
 *     every write operation. A debounced save prevents excessive
 *     I/O when many writes happen in quick succession.
 *
 *  3. On startup the module checks for an existing `memory.db` file
 *     and loads it into memory. If the file is missing or corrupt,
 *     a fresh database is created. This ensures resilience against
 *     accidental deletions.
 *
 *  4. Database lock errors are impossible by design: sql.js uses an
 *     in-memory engine with synchronous queries, so there's no
 *     filesystem-level locking contention. We still wrap every
 *     public function in try/catch to surface helpful diagnostics.
 *
 *  Chain-of-Thought: Schema Design
 *  ────────────────────────────────
 *  1. `users` — Stores authentication credentials. Kept minimal for
 *     local development.
 *
 *  2. `chat_sessions` — Groups messages into conversations. Each
 *     session has a language tag so the server picks the right system
 *     prompt automatically.
 *
 *  3. `chat_messages` — Stores every user prompt and AI response.
 *     The `role` column uses a CHECK constraint ('user'|'ai') to
 *     prevent invalid data. `token_count` enables future token-budget
 *     optimizations for memory retrieval.
 *
 *  4. `session_metadata` — NEW table that tracks per-session stats
 *     (message count, total tokens, last active timestamp). This
 *     enables dashboards, analytics, and smart session pruning
 *     without expensive aggregate queries.
 *
 *  5. Indexes on (session_id, created_at) and (user_id) make the
 *     "get last N messages" and "list user sessions" queries O(log n).
 *  </explanation>
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// ── Configuration ──
const DB_PATH = path.join(__dirname, 'memory.db');
const SAVE_DEBOUNCE_MS = 500; // Debounce disk writes by 500ms

let db = null;
let saveTimer = null;

// ═══════════════════════════════════════════════
// STEP 1: SETUP — Database Initialization
// ═══════════════════════════════════════════════

/**
 * <code module="setup">
 * Initialize the SQLite database.
 * Must be called once before any other database function.
 *
 * - Loads an existing memory.db if found on disk
 * - Creates a fresh database otherwise
 * - Runs all CREATE TABLE IF NOT EXISTS migrations
 * - Applies ALTER TABLE migrations for backwards compatibility
 * </code>
 */
async function initDatabase() {
  try {
    const SQL = await initSqlJs();

    // Load existing database file if it exists, otherwise create new
    if (fs.existsSync(DB_PATH)) {
      try {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
        console.log('✅ Loaded existing database from', DB_PATH);
      } catch (loadError) {
        // File exists but is corrupted — start fresh
        console.warn('⚠️  Database file is corrupted, creating fresh database:', loadError.message);
        db = new SQL.Database();
      }
    } else {
      db = new SQL.Database();
      console.log('✅ Created new database at', DB_PATH);
    }

    // Enable WAL-like pragmas (sql.js supports a subset)
    db.run('PRAGMA journal_mode = MEMORY');
    db.run('PRAGMA foreign_keys = ON');

    // ── Schema Migrations ──
    _runMigrations();

    // Persist immediately after setup
    saveToFile();
    return db;

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
}

/**
 * <schema>
 * Run all table creation and migration statements.
 * Uses IF NOT EXISTS so this is idempotent and safe to re-run.
 * </schema>
 */
function _runMigrations() {
  // ── Users Table ──
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      email      TEXT UNIQUE NOT NULL,
      password   TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ── Chat Sessions Table ──
  db.run(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id         TEXT PRIMARY KEY,
      user_id    TEXT,
      title      TEXT NOT NULL DEFAULT 'New Chat',
      language   TEXT NOT NULL DEFAULT 'en',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Backwards-compatible migration: add user_id if missing
  _safeAlter("ALTER TABLE chat_sessions ADD COLUMN user_id TEXT");

  // ── Chat Messages Table ──
  db.run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id          TEXT PRIMARY KEY,
      session_id  TEXT NOT NULL,
      role        TEXT NOT NULL CHECK(role IN ('user', 'ai')),
      content     TEXT NOT NULL,
      is_error    INTEGER DEFAULT 0,
      token_count INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    )
  `);

  // Backwards-compatible migration: add token_count if missing
  _safeAlter("ALTER TABLE chat_messages ADD COLUMN token_count INTEGER DEFAULT 0");

  // ── Session Metadata Table (NEW) ──
  // Stores per-session aggregates for fast dashboard queries
  db.run(`
    CREATE TABLE IF NOT EXISTS session_metadata (
      session_id     TEXT PRIMARY KEY,
      message_count  INTEGER DEFAULT 0,
      total_tokens   INTEGER DEFAULT 0,
      last_active_at TEXT DEFAULT (datetime('now')),
      summary        TEXT DEFAULT '',
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    )
  `);

  // ── Indexes for Performance ──
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_messages_session
      ON chat_messages(session_id, created_at)
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_sessions_user
      ON chat_sessions(user_id, updated_at)
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_messages_role
      ON chat_messages(session_id, role)
  `);
}

/**
 * Safely attempt an ALTER TABLE. Swallows "duplicate column" errors.
 */
function _safeAlter(sql) {
  try {
    db.run(sql);
  } catch (e) {
    // Column already exists — safe to ignore
  }
}

// ═══════════════════════════════════════════════
// STEP 2: PERSISTENCE — Disk I/O Helpers
// ═══════════════════════════════════════════════

/**
 * <code module="persistence">
 * Persist the in-memory database to disk.
 * Uses debouncing: rapid successive calls only trigger one write.
 *
 * Error handling:
 *  - If the write fails (e.g. disk full, permission denied), we log
 *    the error but don't crash the process. Data remains safe in RAM.
 * </code>
 */
function saveToFile() {
  if (!db) return;

  // Clear any pending save
  if (saveTimer) clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      // Write to a temp file first, then rename — atomic write
      const tmpPath = DB_PATH + '.tmp';
      fs.writeFileSync(tmpPath, buffer);
      fs.renameSync(tmpPath, DB_PATH);
    } catch (error) {
      console.error('⚠️  Failed to persist database to disk:', error.message);
      // Data is still safe in memory — will retry on next save
    }
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Force an immediate synchronous save (used during shutdown).
 */
function saveToFileSync() {
  if (!db) return;
  if (saveTimer) clearTimeout(saveTimer);
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (error) {
    console.error('⚠️  Failed to persist database on shutdown:', error.message);
  }
}

/**
 * Generate a unique ID (similar to what Trickle would provide).
 */
function generateId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Rough token count estimation (~4 chars per token for English).
 * Used for token budgeting in memory retrieval.
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

// ═══════════════════════════════════════════════
// STEP 3: INTEGRATION LOGIC — CRUD Helpers
// ═══════════════════════════════════════════════

// ── Helper to convert sql.js result → object array ──
function _resultToObjects(results) {
  if (!results || results.length === 0) return [];
  const cols = results[0].columns;
  return results[0].values.map(row => {
    const obj = {};
    cols.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

function _resultToObject(results) {
  const objs = _resultToObjects(results);
  return objs.length > 0 ? objs[0] : null;
}

// ──────────────────────────────────────────────
// Session CRUD
// ──────────────────────────────────────────────

/**
 * <code module="sessions">
 * Create a new chat session and its corresponding metadata row.
 * </code>
 */
function createSession(title, language, userId = null) {
  const id = generateId();
  try {
    db.run(
      `INSERT INTO chat_sessions (id, user_id, title, language) VALUES (?, ?, ?, ?)`,
      [id, userId, title || 'New Chat', language || 'en']
    );
    // Also create the metadata tracking row
    db.run(
      `INSERT OR IGNORE INTO session_metadata (session_id) VALUES (?)`,
      [id]
    );
    saveToFile();

    const results = db.exec(`SELECT * FROM chat_sessions WHERE id = '${id}'`);
    return _resultToObject(results) || { id, title: title || 'New Chat', language: language || 'en' };
  } catch (error) {
    console.error('createSession error:', error.message);
    throw error;
  }
}

function getSessions(userId = null, limit = 50) {
  try {
    let query = `SELECT * FROM chat_sessions`;
    if (userId) {
      query += ` WHERE user_id = '${userId}'`;
    } else {
      query += ` WHERE user_id IS NULL`;
    }
    query += ` ORDER BY updated_at DESC LIMIT ${limit}`;
    return _resultToObjects(db.exec(query));
  } catch (error) {
    console.error('getSessions error:', error.message);
    return [];
  }
}

function getSession(id) {
  try {
    const results = db.exec(`SELECT * FROM chat_sessions WHERE id = '${id}'`);
    return _resultToObject(results);
  } catch (error) {
    console.error('getSession error:', error.message);
    return null;
  }
}

function updateSessionTitle(id, title) {
  try {
    db.run(
      `UPDATE chat_sessions SET title = ?, updated_at = datetime('now') WHERE id = ?`,
      [title, id]
    );
    saveToFile();
  } catch (error) {
    console.error('updateSessionTitle error:', error.message);
    throw error;
  }
}

/**
 * Delete a session and all its associated messages and metadata.
 */
function deleteSession(id) {
  try {
    db.run(`DELETE FROM chat_messages WHERE session_id = ?`, [id]);
    db.run(`DELETE FROM session_metadata WHERE session_id = ?`, [id]);
    db.run(`DELETE FROM chat_sessions WHERE id = ?`, [id]);
    saveToFile();
    return true;
  } catch (error) {
    console.error('deleteSession error:', error.message);
    throw error;
  }
}

// ──────────────────────────────────────────────
// Message CRUD
// ──────────────────────────────────────────────

/**
 * <code module="messages">
 * Save a new interaction (user prompt or AI response) to the database.
 *
 * Chain-of-Thought:
 *  1. Generate a unique ID for the message
 *  2. Estimate the token count for future budgeting
 *  3. INSERT the message into chat_messages
 *  4. Update session_metadata counters (message_count, total_tokens, last_active_at)
 *  5. Debounce-save to disk
 * </code>
 */
function createMessage(sessionId, role, content, isError = false) {
  const id = generateId();
  const tokens = estimateTokens(content);

  try {
    db.run(
      `INSERT INTO chat_messages (id, session_id, role, content, is_error, token_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, sessionId, role, content, isError ? 1 : 0, tokens]
    );

    // Update session metadata atomically
    db.run(`
      INSERT INTO session_metadata (session_id, message_count, total_tokens, last_active_at)
      VALUES (?, 1, ?, datetime('now'))
      ON CONFLICT(session_id) DO UPDATE SET
        message_count  = message_count + 1,
        total_tokens   = total_tokens + excluded.total_tokens,
        last_active_at = datetime('now')
    `, [sessionId, tokens]);

    // Also update the session's updated_at timestamp
    db.run(
      `UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?`,
      [sessionId]
    );

    saveToFile();
    return { id, session_id: sessionId, role, content, is_error: isError, token_count: tokens };
  } catch (error) {
    console.error('createMessage error:', error.message);
    throw error;
  }
}

/**
 * Get ALL messages for a session (used when loading full chat history).
 */
function getMessages(sessionId) {
  try {
    const stmt = db.prepare(
      `SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC`
    );
    stmt.bind([sessionId]);

    const messages = [];
    while (stmt.step()) {
      messages.push(stmt.getAsObject());
    }
    stmt.free();
    return messages;
  } catch (error) {
    console.error('getMessages error:', error.message);
    return [];
  }
}

/**
 * <code module="memory">
 * Get the N most recent messages for a session — THE CORE "MEMORY" FUNCTION.
 *
 * Chain-of-Thought:
 *  1. Query the last `messageCount` messages sorted DESC (newest first)
 *  2. Reverse the result to chronological order (oldest → newest)
 *  3. This creates a sliding context window that prevents the AI
 *     prompt from growing unboundedly while still providing relevant
 *     conversation history across restarts.
 *
 *  Why ORDER BY DESC then reverse instead of OFFSET?
 *  → OFFSET-based pagination would require knowing the total count
 *    first. DESC + LIMIT + JS reverse is simpler and equally fast
 *    with our covering index on (session_id, created_at).
 *
 * @param {string} sessionId - The session to retrieve memory for
 * @param {number} messageCount - Number of recent messages (default: 10)
 * @returns {Array} Messages in chronological order (oldest first)
 * </code>
 */
function getConversationMemory(sessionId, messageCount = 10) {
  try {
    const stmt = db.prepare(
      `SELECT id, session_id, role, content, is_error, token_count, created_at
       FROM chat_messages
       WHERE session_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    );
    stmt.bind([sessionId, messageCount]);

    const messages = [];
    while (stmt.step()) {
      messages.push(stmt.getAsObject());
    }
    stmt.free();
    return messages.reverse(); // DESC → ASC (chronological)
  } catch (error) {
    console.error('getConversationMemory error:', error.message);
    return [];
  }
}

/**
 * <code module="memory-advanced">
 * Retrieve context within a token budget — smart memory retrieval.
 *
 * Instead of a fixed message count, this walks backwards through
 * history and collects messages until the total token count exceeds
 * the budget. This is more efficient for AI models with token limits.
 *
 * @param {string} sessionId
 * @param {number} tokenBudget - Max tokens to include (default: 4000)
 * @returns {Array} Messages in chronological order, fitting the budget
 * </code>
 */
function getConversationMemoryByTokens(sessionId, tokenBudget = 4000) {
  try {
    const stmt = db.prepare(
      `SELECT id, session_id, role, content, token_count, created_at
       FROM chat_messages
       WHERE session_id = ?
       ORDER BY created_at DESC`
    );
    stmt.bind([sessionId]);

    const messages = [];
    let usedTokens = 0;

    while (stmt.step()) {
      const msg = stmt.getAsObject();
      const msgTokens = msg.token_count || estimateTokens(msg.content);
      if (usedTokens + msgTokens > tokenBudget && messages.length > 0) break;
      usedTokens += msgTokens;
      messages.push(msg);
    }
    stmt.free();
    return messages.reverse();
  } catch (error) {
    console.error('getConversationMemoryByTokens error:', error.message);
    return [];
  }
}

/**
 * Get metadata for a session (message count, total tokens, etc.).
 */
function getSessionMetadata(sessionId) {
  try {
    const results = db.exec(
      `SELECT * FROM session_metadata WHERE session_id = '${sessionId}'`
    );
    return _resultToObject(results);
  } catch (error) {
    console.error('getSessionMetadata error:', error.message);
    return null;
  }
}

// ──────────────────────────────────────────────
// Auth Functions
// ──────────────────────────────────────────────

function registerUser(email, password) {
  try {
    const existing = db.exec(`SELECT * FROM users WHERE email = '${email}'`);
    if (existing.length > 0 && existing[0].values.length > 0) {
      throw new Error('Email already exists');
    }
    const id = generateId();
    db.run(
      `INSERT INTO users (id, email, password) VALUES (?, ?, ?)`,
      [id, email, password] // Simple plaintext for local dev — use bcrypt in production
    );
    saveToFile();
    return { id, email };
  } catch (error) {
    if (error.message.includes('Email already exists')) throw error;
    console.error('registerUser error:', error.message);
    throw error;
  }
}

function loginUser(email, password) {
  try {
    const results = db.exec(
      `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`
    );
    if (results.length === 0 || results[0].values.length === 0) {
      throw new Error('Invalid email or password');
    }
    const user = _resultToObject(results);
    return { id: user.id, email: user.email };
  } catch (error) {
    if (error.message.includes('Invalid email or password')) throw error;
    console.error('loginUser error:', error.message);
    throw error;
  }
}

function syncOAuthUser(uid, email) {
  try {
    const existing = db.exec(`SELECT * FROM users WHERE email = '${email}'`);
    if (existing.length > 0 && existing[0].values.length > 0) {
      const user = _resultToObject(existing);
      return { id: user.id, email: user.email };
    }
    db.run(
      `INSERT INTO users (id, email, password) VALUES (?, ?, ?)`,
      [uid, email, 'oauth-user-no-pwd']
    );
    saveToFile();
    return { id: uid, email };
  } catch (error) {
    console.error('syncOAuthUser error:', error.message);
    throw error;
  }
}

// ──────────────────────────────────────────────
// Database Lifecycle
// ──────────────────────────────────────────────

/**
 * <code module="lifecycle">
 * Close the database connection gracefully.
 * Uses synchronous save to ensure all data is flushed before exit.
 * </code>
 */
function closeDatabase() {
  if (db) {
    saveToFileSync(); // Flush immediately — no debounce
    db.close();
    db = null;
    console.log('🔒 Database connection closed, data saved to', DB_PATH);
  }
}

// ── Module Exports ──
module.exports = {
  // Lifecycle
  initDatabase,
  closeDatabase,

  // Sessions
  createSession,
  getSessions,
  getSession,
  updateSessionTitle,
  deleteSession,

  // Messages
  createMessage,
  getMessages,

  // Memory (Context Retrieval)
  getConversationMemory,
  getConversationMemoryByTokens,

  // Metadata
  getSessionMetadata,

  // Auth
  registerUser,
  loginUser,
  syncOAuthUser
};
