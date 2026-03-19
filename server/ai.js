/**
 * AI Service integrating OpenRouter
 * Target Model: deepseek/deepseek-chat
 */

const axios = require('axios');

function initializeAI() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  console.log(`[DEBUG] OPENROUTER_API_KEY is ${apiKey ? 'defined' : 'undefined or empty'}`);
  
  if (!apiKey) {
    console.warn('⚠️ OPENROUTER_API_KEY is missing! The service will fall back automatically.');
  } else {
    console.log('✅ OpenRouter AI initialized securely');
  }
}

/**
 * Generate an AI response via OpenRouter.
 *
 * @param {string} systemPrompt
 * @param {Array} conversationHistory 
 * @param {string} userMessage 
 * @returns {string} The AI text response
 */
async function generateResponse(systemPrompt, conversationHistory, userMessage) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured in .env');
  }

  // 1. Format messages into standard layout
  const messages = [{ role: 'system', content: systemPrompt }];

  for (const msg of conversationHistory) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    });
  }
  messages.push({ role: 'user', content: userMessage });

  try {
    console.log(`[AI SERVICE] Calling OpenRouter model 'deepseek/deepseek-chat'...`);

    // 2. Network Request via Axios
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'deepseek/deepseek-chat',
        messages: messages,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'CodeGenerator',
        },
        timeout: 20000 // 20s timeout limit
      }
    );

    const data = response.data;
    
    // 3. Prevent empty responses
    if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
      throw new Error('OpenRouter returned an empty or invalid response.');
    }

    console.log('[AI SERVICE] AI Response received successfully!');
    
    // 4. Return clean plain-text output
    return data.choices[0].message.content;

  } catch (error) {
    // 5. Handle Errors Safely
    if (error.response) {
      const status = error.response.status;
      const errorMsg = error.response.data?.error?.message || error.message;
      console.error(`[AI SERVICE ERROR] OpenRouter API Status ${status}: ${errorMsg}`);
      
      if (status === 401) {
        console.error('-> Make sure your OPENROUTER_API_KEY is valid!');
      } else if (status === 429) {
        console.error('-> OpenRouter Rate limit exceeded or out of credits.');
      }
    } else if (error.request) {
      console.error(`[AI SERVICE ERROR] No response from OpenRouter: ${error.message}`);
    } else {
      console.error(`[AI SERVICE ERROR] Failure to issue request: ${error.message}`);
    }

    // 6. Bonus Fallback logic
    console.warn('[AI SERVICE] Returning fallback message instead of crashing!');
    return `[Fallback Mode Activated] Sorry, the DeepSeek AI backend is temporarily unable to answer. (Error: ${error.message})`;
  }
}

module.exports = { initializeAI, generateResponse };
