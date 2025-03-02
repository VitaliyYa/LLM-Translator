console.log('LLM-Translator: Background script loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'translateText') {
      console.log('LLM-Translator [Background]: Translation request received');
      // Get settings from chrome.storage
      chrome.storage.sync.get(['baseLanguage', 'apiUrl', 'apiKey'], async (settings) => {
        const { baseLanguage, apiUrl, apiKey } = settings;
        console.log('LLM-Translator [Background]: Settings loaded', {
          baseLanguage: baseLanguage || 'not set',
          apiUrl: apiUrl || 'not set',
          apiKey: apiKey ? 'set (hidden)' : 'not set'
        });

        if (!baseLanguage || !apiUrl || !apiKey) {
          console.error('LLM-Translator [Background]: Required settings missing');
          sendResponse({ error: "Settings not configured. Please check extension options." });
          return;
        }
        
        // Creating prompt according to requirements
        const promptText = `You are a translator that follows these strict rules:
1. Translate the input text to ${baseLanguage}
2. Maintain the original text's:
   - Letter case
   - Punctuation
   - Formatting
   - Style and tone
3. Do not add any explanations or notes
4. Focus on natural translation, not word-by-word
5. Pay special attention to idioms and context

Your response must be in this exact JSON format:
{"translation": "translated text goes here"}

Text to translate:
"${message.text}"`;
        
        console.log(`LLM-Translator [Background]: Sending request to API: ${apiUrl}`);
        
        // Determine API type based on URL
        const isGeminiApi = apiUrl.includes('generativelanguage.googleapis.com');
        
        try {
          let response;
          
          if (isGeminiApi) {
            // Request format for Gemini API
            console.log('LLM-Translator [Background]: Using Gemini API format');
            
            // Add API key directly to URL for Gemini API
            const apiUrlWithKey = `${apiUrl}?key=${apiKey}`;
            console.log('LLM-Translator [Background]: Full request URL:', apiUrlWithKey);
            
            const requestBody = {
              contents: [
                {
                  parts: [
                    {
                      text: promptText
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.2,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024
              }
            };
            
            console.log('LLM-Translator [Background]: Gemini request structure:', JSON.stringify(requestBody, null, 2));
            
            response = await fetch(apiUrlWithKey, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestBody)
            });
          } else {
            // Standard format for universal API
            console.log('LLM-Translator [Background]: Using universal API format');
            
            response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify({ prompt: promptText })
            });
          }
          
          console.log(`LLM-Translator [Background]: Response received from API, status: ${response.status}`);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('LLM-Translator [Background]: API error:', response.statusText, errorText);
            sendResponse({ error: `API Error: ${response.statusText} (${response.status}). Details: ${errorText}` });
            return;
          }
          
          const data = await response.json();
          console.log('LLM-Translator [Background]: Data received from API:', data);
          
          // Check response format
          if (data.translation) {
            console.log('LLM-Translator [Background]: Translation successfully received:', data.translation);
            sendResponse({ translation: data.translation });
          } else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            // Check for Gemini API response format
            const content = data.candidates[0].content;
            console.log('LLM-Translator [Background]: Gemini API response received, extracting content:', content);
            
            // Try to extract JSON from response
            try {
              let translationText = '';
              
              // Look for JSON in response
              if (content.parts && content.parts.length > 0) {
                const text = content.parts[0].text;
                console.log('LLM-Translator [Background]: Text extracted from response:', text);
                
                // Try to find JSON in text
                const jsonMatch = text.match(/\{[\s\S]*?\}/g);
                if (jsonMatch && jsonMatch.length > 0) {
                  try {
                    // Check all found JSON structures
                    for (const match of jsonMatch) {
                      try {
                        const jsonData = JSON.parse(match);
                        if (jsonData.translation) {
                          translationText = jsonData.translation;
                          console.log('LLM-Translator [Background]: JSON with translation found:', translationText);
                          break;
                        }
                      } catch (innerJsonError) {
                        console.log('LLM-Translator [Background]: Failed to parse JSON:', match);
                      }
                    }
                  } catch (jsonError) {
                    console.error('LLM-Translator [Background]: JSON parsing error:', jsonError);
                  }
                }
                
                // If no JSON found, use entire text
                if (!translationText) {
                  translationText = text;
                  console.log('LLM-Translator [Background]: Using entire text as translation');
                }
              }
              
              sendResponse({ translation: translationText || 'Failed to extract translation from API response.' });
            } catch (parseError) {
              console.error('LLM-Translator [Background]: Response processing error:', parseError);
              sendResponse({ error: 'API response processing error.' });
            }
          } else {
            console.error('LLM-Translator [Background]: Unknown API response format:', data);
            sendResponse({ error: "Failed to get translation. Unknown response format." });
          }
        } catch (err) {
          console.error('LLM-Translator [Background]: Request error:', err);
          sendResponse({ error: `Connection error or invalid API key: ${err.message}` });
        }
      });
      // Return true so sendResponse can be called asynchronously
      return true;
    }
  });
