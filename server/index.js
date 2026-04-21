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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve the frontend files from the parent directory
app.use(express.static(path.join(__dirname, '..')));
// Serve user uploaded attachments
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── System Prompts (moved from frontend for security) ──
const SYSTEM_PROMPTS = {
  en: "You are a helpful, witty, and highly skilled AI coding assistant. You behave similarly to ChatGPT, offering clear, conversational, and precise answers. You are expert in all programming languages. Always format code blocks with markdown (e.g., ```python). Provide explanations before or after code.",
  ta: "நீங்கள் ஒரு புத்திசாலித்தனமான மற்றும் திறமையான AI குறியீட்டு உதவியாளர். நீங்கள் ChatGPT போலவே செயல்பட வேண்டும். தெளிவான மற்றும் துல்லியமான பதில்களை தமிழில் அளிக்கவும். குறியீட்டுத் தொகுதிகள் (code blocks) ஆங்கிலத்தில் இருக்க வேண்டும். குறியீட்டிற்கு முன் அல்லது பின் விளக்கங்களை அளிக்கவும்.",
  ru: "Вы — полезный, остроумный и высококвалифицированный ИИ-помощник по программированию. Вы ведете себя так же, как ChatGPT, предлагая четкие, разговорные и точные ответы. Вы эксперт во всех языках программирования. Всегда форматируйте блоки кода с помощью markdown. Дайте объяснения до или после кода.",
  ja: "あなたは役に立ち、機知に富み、高度なスキルを持つAIコーディングアシスタントです。ChatGPTと同じように振る舞い、明確で会話的で正確な回答を提供してください。あなたはすべてのプログラミング言語のエキスパートです。コードブロックは常にマークダウンでフォーマットしてください。コードの前後に説明を加えてください。",
  hi: "आप एक सहायक, मजाकिया और अत्यधिक कुशल AI कोडिंग सहायक हैं। आप ChatGPT के समान व्यवहार करते हैं, स्पष्ट, संवादात्मक और सटीक उत्तर देते हैं। आप सभी प्रोग्रामिंग भाषाओं के विशेषज्ञ हैं। कोड ब्लॉक को हमेशा मार्कडाउन के साथ प्रारूपित करें। कोड से पहले या बाद में स्पष्टीकरण दें।",
  te: "మీరు సహాయక, తెలివైన మరియు అత్యంత నైపుణ్యం కలిగిన AI కోడింగ్ అసిస్టెంట్. మీరు ChatGPT వలె ప్రవర్తిస్తారు, స్పష్టమైన మరియు ఖచ్చితమైన సమాధానాలను అందిస్తారు. మీరు అన్ని ప్రోగ్రామింగ్ భాషలలో నిపుణులు. కోడ్ బ్లాక్‌లను ఎల్లప్పుడూ మార్క్‌డౌన్‌తో ఫార్మాట్ చేయండి. కోడ్‌కు ముందు లేదా తర్వాత వివరణలు ఇవ్వండి.",
  ml: "നിങ്ങൾ ഒരു സഹായകനും സർഗ്ഗാത്മകവും വളരെ വൈദഗ്ധ്യമുള്ളതുമായ AI കോഡിംഗ് സഹായിയാണ്. വ്യക്തവും സംഭാഷണപരവും കൃത്യവുമായ ഉത്തരങ്ങൾ നൽകിക്കൊണ്ട് നിങ്ങൾ ChatGPT-ക്ക് സമാനമായി പ്രവർത്തിക്കുന്നു. നിങ്ങൾ എല്ലാ പ്രോഗ്രാമിംഗ് ഭാഷകളിലും വിദഗ്ദ്ധനാണ്. കോഡ് ബ്ലോക്കുകൾ എപ്പോഴും മാർക്ക്ഡൗൺ ഉപയോഗിച്ച് ഫോർമാറ്റ് ചെയ്യുക. കോഡിന് മുമ്പോ ശേഷമോ വിശദീകരണങ്ങൾ നൽകുക.",
  or: "ଆପଣ ଜଣେ ସାହାଯ୍ୟକାରୀ, ଚତୁର ଏବଂ ଅତ୍ୟନ୍ତ ଦକ୍ଷ AI କୋଡିଂ ସହାୟକ। ଆପଣ ସ୍ପଷ୍ଟ ଏବଂ ସଠିକ୍ ଉତ୍ତର ପ୍ରଦାନ କରି ChatGPT ପରି ବ୍ୟବହାର କରନ୍ତି। ଆପଣ ସମସ୍ତ ପ୍ରୋଗ୍ରାମିଂ ଭାଷାରେ ବିଶେଷଜ୍ଞ। କୋଡ୍ ବ୍ଲକ୍ ଗୁଡ଼ିକୁ ସର୍ବଦା ମାର୍କଡାଉନ୍ ସହିତ ଫର୍ମାଟ୍ କରନ୍ତୁ। କୋଡ୍ ପୂର୍ବରୁ କିମ୍ବା ପରେ ବୁଝାନ୍ତୁ।"
};

// ══════════════════════════════════════════════
// AUTHENTICATION ENDPOINTS
// ══════════════════════════════════════════════

// POST /api/register
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await db.registerUser(email, password);
    res.json({ success: true, user });
  } catch (error) {
    if (error.message.includes('Email already exists')) return res.status(400).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await db.loginUser(email, password);
    res.json({ success: true, user });
  } catch (error) {
    if (error.message.includes('Invalid email or password')) return res.status(401).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/sync
app.post('/api/auth/sync', async (req, res) => {
  try {
    const { uid, email } = req.body;
    if (!uid || !email) return res.status(400).json({ error: 'UID and email required' });
    const user = await db.syncOAuthUser(uid, email);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════
// SESSION ENDPOINTS
// ══════════════════════════════════════════════

// GET /api/sessions — List all sessions (newest first)
app.get('/api/sessions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const userId = req.query.userId || null;
    const sessions = await db.getSessions(userId, limit);
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
app.post('/api/sessions', async (req, res) => {
  try {
    const { title, language, userId } = req.body;
    const session = await db.createSession(title, language, userId);
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
app.put('/api/sessions/:id', async (req, res) => {
  try {
    const { title } = req.body;
    await db.updateSessionTitle(req.params.id, title);
    res.json({ success: true });
  } catch (error) {
    console.error('PUT /api/sessions/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/sessions/:id — Delete a session and all its messages
app.delete('/api/sessions/:id', async (req, res) => {
  try {
    await db.deleteSession(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/sessions/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════
// MESSAGE ENDPOINTS
// ══════════════════════════════════════════════

// GET /api/sessions/:id/messages — Get all messages for a session
app.get('/api/sessions/:id/messages', async (req, res) => {
  try {
    const messages = await db.getMessages(req.params.id);
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

// POST /api/messages — Save a message to the database
app.post('/api/messages', async (req, res) => {
  try {
    const { sessionId, role, content, isError, attachments } = req.body;

    let dbContent = content;
    if (attachments && attachments.length > 0) {
      dbContent = JSON.stringify({ text: content, attachedFiles: attachments });
    }

    const message = await db.createMessage(sessionId, role, dbContent, isError);
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

// POST /api/chat — Invoke the AI Chat
app.post('/api/chat', async (req, res) => {
  const { sessionId, message, language, attachments, skillLevel } = req.body;

  try {
    const promptLang = language || 'en';
    let systemPrompt = SYSTEM_PROMPTS[promptLang] || SYSTEM_PROMPTS['en'];

    if (skillLevel) {
      const skillInstructions = {
        'newbie': '\n\nIMPORTANT INSTRUCTION: The user is completely new to coding. Provide very simple, step-by-step explanations. Avoid jargon, use basic analogies, and explain what EVERY line of code does.',
        'beginner': '\n\nIMPORTANT INSTRUCTION: The user is a beginner. Provide moderate explanations with clear examples. Explain key concepts clearly.',
        'intermediate': '\n\nIMPORTANT INSTRUCTION: The user is an intermediate programmer. Focus on logic, architecture, and optimization. Do not over-explain basic syntax.',
        'practice': '\n\nIMPORTANT INSTRUCTION: The user is practicing. Act as a technical interviewer. DO NOT give direct answers right away. Provide challenges and minimal hints.'
      };
      if (skillInstructions[skillLevel]) {
        systemPrompt += skillInstructions[skillLevel];
      }
    }

    // 1. Get Conversation Memory
    let history = [];
    if (sessionId) {
      const msgs = await db.getConversationMemory(sessionId, 10);
      history = msgs.map(m => {
        let msgContent = m.content;
        try {
          if (m.content.startsWith('{') && m.content.includes('"text":')) {
            msgContent = JSON.parse(m.content).text;
          }
        } catch (e) { }
        return {
          role: m.role,
          content: msgContent
        };
      });
    }

    // Process uploaded base64 files
    const fs = require('fs');
    let processedAttachments = [];
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.data) {
          const base64Data = att.data.replace(/^data:([A-Za-z-+/]+);base64,/, '');
          const filename = `${Date.now()}-${att.name}`;
          const filepath = path.join(__dirname, 'uploads', filename);
          fs.writeFileSync(filepath, base64Data, 'base64');

          processedAttachments.push({
            name: att.name,
            mimeType: att.mimeType || 'image/jpeg',
            url: `/uploads/${filename}`,
            base64Data: base64Data
          });
        }
      }
    }

    // 2. Generate AI Response
    const aiResponseText = await generateResponse(systemPrompt, history, message, processedAttachments);

    res.json({ response: aiResponseText, processedAttachments });
  } catch (error) {
    console.error('POST /api/chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════
// SIMPLE /GENERATE ROUTE
// ══════════════════════════════════════════════
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const aiText = await generateResponse("You are a helpful assistant.", [], prompt);

    res.json({ response: aiText });
  } catch (error) {
    console.error('API /generate error:', error.message);
    res.status(500).json({ error: 'An error occurred generating response.' });
  }
});

// ══════════════════════════════════════════════
// SESSION METADATA ENDPOINT
// ══════════════════════════════════════════════

// GET /api/sessions/:id/metadata — Get session stats
app.get('/api/sessions/:id/metadata', async (req, res) => {
  try {
    const meta = await db.getSessionMetadata(req.params.id);
    if (!meta) return res.status(404).json({ error: 'Session not found' });
    res.json(meta);
  } catch (error) {
    console.error('GET /api/sessions/:id/metadata error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════
// SPEECH TO TEXT ENDPOINT (NVIDIA PARAKEET)
// ══════════════════════════════════════════════
const multer = require('multer');
const { OpenAI, toFile } = require('openai');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

const nvidiaOpenAI = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1"
});

app.post('/api/transcribe', upload.single('audioFile'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('[SPEECH API Error] No audio payload intercepted by Multer.');
      return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    console.log(`[SPEECH API] Request received: ${req.file.originalname}, Size: ${(req.file.size / 1024).toFixed(2)} KB, Mime: ${req.file.mimetype}`);

    const audioFile = await toFile(req.file.buffer, 'recording.webm', { type: 'audio/webm' });

    const transcription = await nvidiaOpenAI.audio.transcriptions.create({
      file: audioFile,
      model: 'nvidia/parakeet-ctc-1.1b-asr',
      temperature: 0,
      language: 'en'
    });

    console.log('[SPEECH API] Transcribed successfully: ', transcription.text);
    res.json({ text: transcription.text });
  } catch (error) {
    console.error('API /transcribe error:', error);
    const errorMsg = error.status ? `NVIDIA API HTTP ${error.status} - ${error.error?.message}` : error.message;
    res.status(500).json({ error: `Speech-to-text failed: ${errorMsg}` });
  }
});

// ── Health Check ──
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'connected (mongodb)',
    memoryWindow: '10 messages'
  });
});

// ── Start Server ──
async function startServer() {
  try {
    // Initialize database first
    await db.initDatabase();

    // Try to initialize AI
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
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await db.closeDatabase();
  process.exit(0);
});
