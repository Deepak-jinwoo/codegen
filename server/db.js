const mongoose = require('mongoose');

// Generate unique ID helper
function generateId() {
  return 'm' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}

// ──────────────────────────────────────────────
// Mongoose Schemas
// ──────────────────────────────────────────────

const UserSchema = new mongoose.Schema({
  id: { type: String, unique: true, default: generateId },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const ChatSessionSchema = new mongoose.Schema({
  id: { type: String, unique: true, default: generateId },
  user_id: { type: String, default: null },
  title: { type: String, required: true, default: 'New Chat' },
  language: { type: String, required: true, default: 'en' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const ChatMessageSchema = new mongoose.Schema({
  id: { type: String, unique: true, default: generateId },
  session_id: { type: String, required: true },
  role: { type: String, required: true },
  content: { type: String, required: true },
  is_error: { type: Boolean, default: false },
  token_count: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});

const SessionMetadataSchema = new mongoose.Schema({
  session_id: { type: String, unique: true, required: true },
  message_count: { type: Number, default: 0 },
  total_tokens: { type: Number, default: 0 },
  last_active_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const ChatSession = mongoose.model('ChatSession', ChatSessionSchema);
const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);
const SessionMetadata = mongoose.model('SessionMetadata', SessionMetadataSchema);

// ──────────────────────────────────────────────
// Initialization
// ──────────────────────────────────────────────

async function initDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI environment variable is missing.');
    throw new Error('MONGODB_URI is required to connect to MongoDB.');
  }

  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB Cloud');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
    throw err;
  }
}

async function closeDatabase() {
  await mongoose.disconnect();
  console.log('🔒 Disconnected from MongoDB');
}

// ──────────────────────────────────────────────
// Auth Functions
// ──────────────────────────────────────────────

async function registerUser(email, password) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new Error('Email already exists');
  }
  const id = generateId();
  const user = await User.create({ id, email, password });
  return { id: user.id, email: user.email };
}

async function loginUser(email, password) {
  const user = await User.findOne({ email, password });
  if (!user) {
    throw new Error('Invalid email or password');
  }
  return { id: user.id, email: user.email };
}

async function syncOAuthUser(uid, email) {
  let user = await User.findOne({ email });
  if (user) {
    return { id: user.id, email: user.email };
  }
  user = await User.create({ id: uid, email, password: 'oauth-user-no-pwd' });
  return { id: user.id, email: user.email };
}

// ──────────────────────────────────────────────
// Session Functions
// ──────────────────────────────────────────────

async function createSession(title, language, userId = null) {
  const id = generateId();
  const session = await ChatSession.create({
    id,
    user_id: userId,
    title,
    language
  });
  
  await SessionMetadata.create({
    session_id: id,
    message_count: 0,
    total_tokens: 0
  });

  return session;
}

async function getSessions(userId = null, limit = 50) {
  let query = {};
  if (userId) {
    query.user_id = userId;
  }
  const sessions = await ChatSession.find(query)
                                    .sort({ updated_at: -1 })
                                    .limit(limit);
  return sessions;
}

async function getSession(sessionId) {
  return await ChatSession.findOne({ id: sessionId });
}

async function updateSessionTitle(sessionId, newTitle) {
  await ChatSession.updateOne({ id: sessionId }, { title: newTitle, updated_at: new Date() });
}

async function deleteSession(sessionId) {
  await ChatMessage.deleteMany({ session_id: sessionId });
  await SessionMetadata.deleteOne({ session_id: sessionId });
  await ChatSession.deleteOne({ id: sessionId });
}

// ──────────────────────────────────────────────
// Message Functions
// ──────────────────────────────────────────────

async function createMessage(sessionId, role, content, isError = false, tokenCount = 0) {
  const id = generateId();
  const message = await ChatMessage.create({
    id,
    session_id: sessionId,
    role,
    content,
    is_error: isError,
    token_count: tokenCount
  });

  await ChatSession.updateOne({ id: sessionId }, { updated_at: new Date() });

  await SessionMetadata.updateOne(
    { session_id: sessionId },
    { 
      $inc: { message_count: 1, total_tokens: tokenCount },
      $set: { last_active_at: new Date() }
    }
  );

  return message;
}

async function getMessages(sessionId) {
  return await ChatMessage.find({ session_id: sessionId }).sort({ created_at: 1 });
}

// ──────────────────────────────────────────────
// Memory / Context Functions
// ──────────────────────────────────────────────

async function getConversationMemory(sessionId, maxMessages = 10) {
  const messages = await ChatMessage.find({ session_id: sessionId })
                                    .sort({ created_at: -1 })
                                    .limit(maxMessages);
  // Return oldest first
  return messages.reverse();
}

async function getConversationMemoryByTokens(sessionId, maxTokens = 6000) {
  const messages = await ChatMessage.find({ session_id: sessionId })
                                    .sort({ created_at: -1 })
                                    .limit(50);
  
  let selected = [];
  let currentTokens = 0;
  
  for (const msg of messages) {
    if (currentTokens + msg.token_count > maxTokens) break;
    selected.push(msg);
    currentTokens += msg.token_count;
  }
  
  return selected.reverse();
}

// ──────────────────────────────────────────────
// Metadata Functions
// ──────────────────────────────────────────────

async function getSessionMetadata(sessionId) {
  return await SessionMetadata.findOne({ session_id: sessionId });
}

module.exports = {
  initDatabase,
  closeDatabase,

  createSession,
  getSessions,
  getSession,
  updateSessionTitle,
  deleteSession,

  createMessage,
  getMessages,

  getConversationMemory,
  getConversationMemoryByTokens,
  getSessionMetadata,

  registerUser,
  loginUser,
  syncOAuthUser
};
