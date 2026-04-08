/**
 * AI Service integrating OpenRouter (Text) and NVIDIA (Images)
 */

const axios = require('axios');

// NVIDIA Key mapping for image capabilities
const NVIDIA_API_KEY = "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";

function initializeAI() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  console.log(`[DEBUG] OPENROUTER_API_KEY is ${apiKey ? 'defined' : 'undefined or empty'}`);
  
  if (!apiKey) {
    console.warn('⚠️ OPENROUTER_API_KEY is missing! Text generation will fail.');
  } else {
    console.log('✅ OpenRouter AI initialized securely for Text');
  }
}

/**
 * Generate an AI response dynamically routing between OpenRouter and NVIDIA.
 */
async function generateResponse(systemPrompt, conversationHistory, userMessage, attachments = []) {
  // 1. Format messages into standard layout
  const messages = [{ role: 'system', content: systemPrompt }];

  for (const msg of conversationHistory) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    });
  }

  const hasImages = attachments && attachments.length > 0;

  // -- ROUTING LOGIC --
  if (hasImages) {
    // ══════════════════════════════════════════════
    //     IMAGE UPLOAD -> ROUTE TO NVIDIA API
    // ══════════════════════════════════════════════
    console.log(`[AI SERVICE] Images detected. Routing to NVIDIA Vision API ('google/gemma-3-27b-it')...`);

    const finalContent = [
      { type: 'text', text: userMessage || 'Describe this image clearly.' }
    ];

    for (const att of attachments) {
      if (att.mimeType.startsWith('image/')) {
        // Gemma-3 supports standard base64 multi-modal specs
        finalContent.push({
          type: 'image_url',
          image_url: { url: `data:${att.mimeType};base64,${att.base64Data}` }
        });
      }
    }

    // NVIDIA Gemma-3 Vision strictly requires NO system prompt and NO history arrays with mixed payload formats!
    const visionMessages = [
      { role: 'user', content: finalContent }
    ];

    try {
      const response = await axios.post(
        'https://integrate.api.nvidia.com/v1/chat/completions',
        {
          model: 'google/gemma-3-27b-it',
          messages: visionMessages,
          max_tokens: 512,
          temperature: 0.20,
          top_p: 0.70,
          stream: false // Disabled stream to match React frontend parser
        },
        {
          headers: {
            'Authorization': `Bearer ${NVIDIA_API_KEY}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          timeout: 30000 
        }
      );

      const data = response.data;
      if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
        throw new Error('NVIDIA API returned an empty or invalid response.');
      }
      console.log('[AI SERVICE] NVIDIA Vision Response received successfully!');
      return data.choices[0].message.content;

    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.response?.data?.detail || error.message;
      console.error(`[AI SERVICE ERROR] NVIDIA Vision Status ${error.response?.status}: ${errorMsg}`);
      return `[Validation Complete] We checked the files, but the Vision AI is temporarily disabled. (Error: ${error.message})`;
    }

  } else {
    // ══════════════════════════════════════════════
    //   TEXT/CODE ONLY -> ROUTE TO OPENROUTER
    // ══════════════════════════════════════════════
    console.log(`[AI SERVICE] Text only. Routing to OpenRouter ('deepseek/deepseek-chat')...`);
    
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) throw new Error('OPENROUTER_API_KEY is not configured in .env');

    messages.push({ role: 'user', content: userMessage });

    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'deepseek/deepseek-chat',
          messages: messages,
        },
        {
          headers: {
            'Authorization': `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'CodeGenerator',
          },
          timeout: 20000
        }
      );

      const data = response.data;
      if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
        throw new Error('OpenRouter returned an empty or invalid response.');
      }
      console.log('[AI SERVICE] OpenRouter Text Response received successfully!');
      return data.choices[0].message.content;

    } catch (error) {
      const status = error.response?.status;
      const errorMsg = error.response?.data?.error?.message || error.message;
      console.error(`[AI SERVICE ERROR] OpenRouter API Status ${status}: ${errorMsg}`);
      return `[Fallback Mode Activated] Sorry, the DeepSeek AI backend is temporarily unable to answer. (Error: ${error.message})`;
    }
  }
}

module.exports = { initializeAI, generateResponse };
