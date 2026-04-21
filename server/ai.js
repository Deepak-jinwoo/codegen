/**
 * AI Service integrating OpenRouter (Text) and NVIDIA (Images)
 */

const axios = require('axios');

// NVIDIA Key from environment
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

function initializeAI() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;

  console.log(`[DEBUG] OPENROUTER_API_KEY is ${apiKey ? 'defined' : 'undefined or empty'}`);
  console.log(`[DEBUG] NVIDIA_API_KEY is ${nvidiaKey ? 'defined' : 'undefined or empty'}`);
  
  if (!apiKey && !nvidiaKey) {
    console.warn('⚠️ No AI API keys configured! Text generation will fail.');
  } else if (!apiKey) {
    console.log('✅ OpenRouter missing, but NVIDIA AI is available as fallback');
  } else {
    console.log('✅ OpenRouter AI initialized securely for Text');
  }
}

/**
 * Generate an AI response dynamically routing between OpenRouter and NVIDIA.
 */
async function generateResponse(systemPrompt, conversationHistory, userMessage, attachments = []) {
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
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${NVIDIA_API_KEY}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          timeout: 40000 
        }
      );

      const data = response.data;
      if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
        throw new Error('NVIDIA API returned an empty or invalid response.');
      }
      return data.choices[0].message.content;

    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.response?.data?.detail || error.message;
      console.error(`[AI SERVICE ERROR] NVIDIA Vision Status ${error.response?.status}: ${errorMsg}`);
      return `[Validation Complete] We checked the files, but the Vision AI is temporarily disabled. (Error: ${errorMsg})`;
    }

  } else {
    // ══════════════════════════════════════════════
    //   TEXT/CODE ONLY -> ROUTE TO OPENROUTER (OR FALLBACK TO NVIDIA)
    // ══════════════════════════════════════════════
    const openRouterKey = process.env.OPENROUTER_API_KEY;

    if (openRouterKey) {
      console.log(`[AI SERVICE] Text only. Routing to OpenRouter ('deepseek/deepseek-chat')...`);
      
      const messages = [{ role: 'system', content: systemPrompt }];
      for (const msg of conversationHistory) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
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
        return data.choices[0].message.content;

      } catch (error) {
        console.error(`[AI SERVICE ERROR] OpenRouter API Status ${error.response?.status}: ${error.message}`);
        return `[Fallback Mode Activated] Sorry, the DeepSeek AI backend is temporarily unable to answer. (Error: ${error.message})`;
      }
    } else if (NVIDIA_API_KEY) {
      // ══════════════════════════════════════════════
      //   FALLBACK: ROUTE TEXT TO NVIDIA API
      // ══════════════════════════════════════════════
      console.warn(`[AI SERVICE] OPENROUTER_API_KEY missing. Falling back to NVIDIA ('google/gemma-3-27b-it')...`);

      // Construct a payload that NVIDIA Gemma-3 supports (no 'system' role, history only)
      // Merge system prompt into first user message or just avoid it
      // We prepend the system prompt instructions to the current user message to avoid 'system' role issues
      const finalPrompt = `Instructions: ${systemPrompt}\n\nUser Message: ${userMessage}`;
      
      const rawHistory = conversationHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      // Remove the last message from history if it is the recently saved current user message
      if (rawHistory.length > 0 && rawHistory[rawHistory.length - 1].role === 'user' && rawHistory[rawHistory.length - 1].content === userMessage) {
        rawHistory.pop();
      }

      // Enforce strictly alternating roles starting with 'user' (NVIDIA requirement)
      const validHistory = [];
      let expectedRole = 'user';

      for (const msg of rawHistory) {
        if (msg.role === expectedRole) {
          validHistory.push(msg);
          expectedRole = expectedRole === 'user' ? 'assistant' : 'user';
        }
      }

      // If validHistory still ends with 'user', we must pop it because we are about to push
      // finalPrompt (which is also a 'user' role) at the end of the array.
      if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === 'user') {
        validHistory.pop();
      }

      const nvidiaMessages = [...validHistory, { role: 'user', content: finalPrompt }];

      try {
        const response = await axios.post(
          'https://integrate.api.nvidia.com/v1/chat/completions',
          {
            model: 'google/gemma-3-27b-it',
            messages: nvidiaMessages,
            max_tokens: 1024,
            temperature: 0.20,
            top_p: 0.70,
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
          throw new Error('NVIDIA Text API returned an empty or invalid response.');
        }
        console.log('[AI SERVICE] NVIDIA Text Response received successfully!');
        return data.choices[0].message.content;

      } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.response?.data?.detail || error.message;
        console.error(`[AI SERVICE ERROR] NVIDIA Text Status ${error.response?.status}: ${errorMsg}`);
        return `[Critical Error] No API keys configured or active. Please check your .env file. (Error: ${errorMsg})`;
      }
    } else {
        return "[Error] No AI API keys (OpenRouter or NVIDIA) are configured in the server environment.";
    }
  }
}

module.exports = { initializeAI, generateResponse };
