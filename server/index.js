/**
 * Main Express server — replaces the Trickle platform SDK.
 *
 * Endpoint mapping:
 *   invokeAIAgent()       → POST /api/chat
 *   trickleCreateObject() → POST /api/sessions, POST /api/messages
 *   trickleListObjects()  → GET  /api/sessions, GET  /api/sessions/:id/messages
 *   trickleUpdateObject() → PUT  /api/sessions/:id
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');

const db = require('./db');
const { initializeAI, generateResponse } = require('./ai');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(cors());
app.use(express.json());

// Serve the frontend files from the parent directory
app.use(express.static(path.join(__dirname, '..')));

// ── System Prompts (moved from frontend for security) ──
const SYSTEM_PROMPTS = {
  en: "You are a helpful, witty, and highly skilled AI coding assistant. You behave similarly to ChatGPT, offering clear, conversational, and precise answers. You are expert in all programming languages. Always format code blocks with markdown (e.g., ```python). Provide explanations before or after code.",
  ta: "நீங்கள் ஒரு புத்திசாலித்தனமான மற்றும் திறமையான AI குறியீட்டு உதவியாளர். நீங்கள் ChatGPT போலவே செயல்பட வேண்டும். தெளிவான மற்றும் துல்லியமான பதில்களை தமிழில் அளிக்கவும். குறியீட்டுத் தொகுதிகள் (code blocks) ஆங்கிலத்தில் இருக்க வேண்டும். குறியீட்டிற்கு முன் அல்லது பின் விளக்கங்களை அளிக்கவும்.",
  ru: "Вы — полезный, остроумный и высококвалифицированный ИИ-помощник по программированию. Вы ведете себя так же, как ChatGPT, предлагая четкие, разговорные и точные ответы. Вы эксперт во всех языках программирования. Всегда форматируйте блоки кода с помощью markdown. Дайте объяснения до или после кода.",
  ja: "あなたは役に立ち、機知に富み、高度なスキルを持つAIコーディングアシスタントです。ChatGPTと同じように振る舞い、明確で会話的で正確な回答を提供してください。あなたはすべてのプログラミング言語のエキスパートです。コードブロックは常にマークダウンでフォーマットしてください。コードの前後に説明を加えてください。"
};

// ══════════════════════════════════════════════
// SESSION ENDPOINTS
// ══════════════════════════════════════════════

// GET /api/sessions — List all sessions (newest first)
app.get('/api/sessions', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const sessions = db.getSessions(limit);
    const items = sessions.map(s => ({
      objectId: s.id,
      objectData: {
        title: s.title,
        language: s.language
      },
      createdAt: s.created_at
    }));
    res.json({ items });
  } catch (error) {
    console.error('GET /api/sessions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sessions — Create a new session
app.post('/api/sessions', (req, res) => {
  try {
    const { title, language } = req.body;
    const session = db.createSession(title, language);
    res.json({
      objectId: session.id,
      objectData: {
        title: session.title,
        language: session.language
      },
      createdAt: session.created_at
    });
  } catch (error) {
    console.error('POST /api/sessions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/sessions/:id — Update session title
app.put('/api/sessions/:id', (req, res) => {
  try {
    const { title } = req.body;
    db.updateSessionTitle(req.params.id, title);
    res.json({ success: true });
  } catch (error) {
    console.error('PUT /api/sessions/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════
// MESSAGE ENDPOINTS
// ══════════════════════════════════════════════

// GET /api/sessions/:id/messages — Get all messages for a session
app.get('/api/sessions/:id/messages', (req, res) => {
  try {
    const messages = db.getMessages(req.params.id);
    const items = messages.map(m => ({
      objectId: m.id,
      objectData: {
        sessionId: m.session_id,
        role: m.role,
        content: m.content,
        isError: !!m.is_error
      },
      createdAt: m.created_at
    }));
    res.json({ items });
  } catch (error) {
    console.error('GET /api/sessions/:id/messages error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/messages — Save a message
app.post('/api/messages', (req, res) => {
  try {
    const { sessionId, role, content, isError } = req.body;
    const message = db.createMessage(sessionId, role, content, isError);
    res.json({
      objectId: message.id,
      objectData: {
        sessionId: message.session_id,
        role: message.role,
        content: message.content,
        isError: message.is_error
      }
    });
  } catch (error) {
    console.error('POST /api/messages error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════
// CHAT ENDPOINT (AI with memory)
// ══════════════════════════════════════════════

/**
 * POST /api/chat — Main AI endpoint with conversation memory
 *
 * The "memory" is implemented by:
 * 1. Loading the last 20 messages from SQLite for this session
 * 2. Formatting them as conversation history in the prompt
 * 3. Sending the full context to Gemini
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, message, language } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get conversation memory from database
    const memoryMessages = sessionId
      ? db.getConversationMemory(sessionId, 20)
      : [];

    console.log(`💬 Chat request | Session: ${sessionId || 'new'} | Memory: ${memoryMessages.length} messages`);

    // Select system prompt based on language
    const systemPrompt = SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS.en;

    // Call AI with conversation memory as context
    const responseText = await generateResponse(
      systemPrompt,
      memoryMessages,
      message
    );

    res.json({ response: responseText });
  } catch (error) {
    console.error('POST /api/chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════
// SIMPLE /GENERATE ROUTE (OpenRouter Bonus)
// ══════════════════════════════════════════════
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Call the generic AI service with no system prompt and no history
    const aiText = await generateResponse("You are a helpful assistant.", [], prompt);
    
    res.json({ response: aiText });
  } catch (error) {
    console.error('API /generate error:', error.message);
    res.status(500).json({ error: 'An error occurred generating response.' });
  }
});

// ── Health Check ──
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// ── Start Server ──
async function startServer() {
  try {
    // Initialize database first
    await db.initDatabase();

    // Try to initialize AI (warn if API key not set)
    try {
      initializeAI();
    } catch (e) {
      console.warn('⚠️  AI initialization warning:', e.message);
      console.warn('   The server will start, but /api/chat will fail until the API key is set.');
    }

    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════╗
║   🚀 CodeGen AI Server                      ║
║   Running on http://localhost:${PORT}          ║
║   Open this URL in your browser!             ║
╚══════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  db.closeDatabase();
  process.exit(0);
});
