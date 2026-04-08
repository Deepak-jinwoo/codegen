function ChatInterface({ sessionId, language, toggleSidebar, onSessionCreated, onSessionUpdated, onGoHome }) {
  const t = TRANSLATIONS[language];
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isInitializing, setIsInitializing] = React.useState(false);
  const [attachments, setAttachments] = React.useState([]);
  const [isRecording, setIsRecording] = React.useState(false);
  const [isTranscribing, setIsTranscribing] = React.useState(false);
  const messagesEndRef = React.useRef(null);
  const fileInputRef = React.useRef(null);
  const mediaRecorderRef = React.useRef(null);
  const audioChunksRef = React.useRef([]);

  // Track if we are currently handling a session creation to prevent duplicates
  const creationInProgress = React.useRef(false);
  // Track if we just created a session to avoid reloading messages and wiping state
  const justCreatedSessionId = React.useRef(null);

  // Load messages when sessionId changes
  React.useEffect(() => {
    if (sessionId) {
      if (sessionId === justCreatedSessionId.current) {
        justCreatedSessionId.current = null;
        return;
      }
      loadMessages(sessionId);
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  const loadMessages = async (id) => {
    setIsInitializing(true);
    try {
      const dbMessages = await getMessages(id);
      const formattedMessages = dbMessages.map(item => ({
        role: item.objectData.role,
        content: item.objectData.content,
        isError: item.objectData.isError
      }));
      setMessages(formattedMessages);
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newFiles = files.slice(0, 4 - attachments.length);
    newFiles.forEach(file => {
      // Task 3: Validate file size and format before sending
      if (!file.type.startsWith('image/')) {
        console.error('Invalid file format. Only images are supported.');
        alert('Only image files are supported.');
        return;
      }
      
      if (file.size > 4 * 1024 * 1024) { // 4MB limit
        console.error(`File ${file.name} is too large. Maximum size is 4MB.`);
        alert(`File ${file.name} is too large. maximum size is 4MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachments(prev => [...prev, {
          name: file.name,
          mimeType: file.type || 'image/jpeg',
          data: event.target.result // Base64 data URI
        }]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const API_BASE = window.location.port !== '3000' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000' : window.location.origin;

  const toggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.stop) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    // Task 1: Check for blazing fast native Browser Speech Recognition (100% FREE, No NVIDIA API errors!)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      recognition.onstart = () => setIsRecording(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev.trim() ? " " : "") + transcript);
      };
      recognition.onerror = (event) => {
        console.error("Native Speech recognition error:", event.error);
        setIsRecording(false);
      };
      recognition.onend = () => setIsRecording(false);
      
      mediaRecorderRef.current = recognition;
      recognition.start();
      return;
    }

    // Task 2: Fallback to Backend Express Multi-Part Pipeline (If native isn't supported)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop()); // Release mic

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('audioFile', audioBlob, 'recording.webm');

          const response = await fetch(`${API_BASE}/api/transcribe`, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Transcription failed');
          }
          const data = await response.json();
          if (data.text) {
            setInput(prev => prev + (prev.trim() ? " " : "") + data.text);
          }
        } catch (error) {
          console.error("STT Error:", error);
          alert(`Speech-to-text failed: ${error.message}`);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone error:", error);
      alert("Microphone access denied or not available. Note: browsers require localhost or HTTPS for mic API.");
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);



  const invokeAIWithRetry = async (sessionId, message, language, currentAttachments, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const payload = { sessionId, message, language, attachments: currentAttachments };
        console.log(`Sending payload to backend API (Attempt ${i+1}):`, payload);
        
        const response = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.error(`Backend API Error (Status ${response.status}):`, errData);
          throw new Error(errData.error || `HTTP ${response.status} - Request failed`);
        }
        
        const data = await response.json();
        return data.response;
      } catch (error) {
        console.warn(`AI request failed (attempt ${i + 1}/${retries}):`, error);
        if (i === retries - 1) {
            throw new Error(error.message || "All retry attempts failed. Please check network and backend.");
        }
        await new Promise(res => setTimeout(res, 1000 * (i + 1))); // Exponential backoff
      }
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const content = input;
    const submittedAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    const userMessage = { role: 'user', content, attachedFiles: submittedAttachments };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    try {
      let currentId = sessionId;

      if (!currentId) {
        if (creationInProgress.current) return;
        creationInProgress.current = true;

        try {
          const title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
          const newSession = await createSession(title, language);
          justCreatedSessionId.current = newSession.objectId;
          currentId = newSession.objectId;
          onSessionCreated(newSession);
        } finally {
          creationInProgress.current = false;
        }
      }

      if (currentId) {
        await saveMessage(currentId, 'user', content, false, submittedAttachments);
      }

      const aiResponse = await invokeAIWithRetry(currentId, content, language, submittedAttachments);

      if (currentId) {
        await saveMessage(currentId, 'ai', aiResponse, false, []);
      }

      setMessages(prev => [...prev, { role: 'ai', content: aiResponse }]);

    } catch (error) {
      console.error("AI/DB Error:", error);
      const errorMsg = t.error + (error.message ? ` (${error.message})` : "");
      setMessages(prev => [...prev, { role: 'ai', content: errorMsg, isError: true }]);
      if (sessionId || justCreatedSessionId.current) {
        try {
          await saveMessage(sessionId || justCreatedSessionId.current, 'ai', errorMsg, true);
        } catch (e) { console.error("Failed to save error:", e); }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const promptCards = [
    {
      icon: 'grid_view',
      label: 'UI/UX Layer',
      title: t.example1 || 'Generate React UI',
      gradient: 'from-primary-container/5 to-transparent',
      hoverShadow: 'hover:shadow-[0_0_30px_rgba(0,245,255,0.05)]',
      hoverBorder: 'hover:border-primary-container/30',
      iconColor: 'text-primary-container',
    },
    {
      icon: 'database',
      label: 'Architecture',
      title: t.example2 || 'Explain SQL',
      gradient: 'from-secondary/5 to-transparent',
      hoverShadow: 'hover:shadow-[0_0_30px_rgba(196,171,255,0.05)]',
      hoverBorder: 'hover:border-secondary/30',
      iconColor: 'text-secondary',
    },
    {
      icon: 'bug_report',
      label: 'Logic Debug',
      title: t.example3 || 'Debug Node.js',
      gradient: 'from-on-surface-variant/5 to-transparent',
      hoverShadow: 'hover:shadow-[0_0_30px_rgba(250,250,255,0.05)]',
      hoverBorder: 'hover:border-on-surface-variant/30',
      iconColor: 'text-on-surface-variant',
    },
  ];

  // Loading state
  if (isInitializing) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#00f5ff]/30 border-t-[#00f5ff] rounded-full animate-spin"></div>
          <span className="font-['Space_Grotesk'] text-xs tracking-[0.2em] text-slate-500 uppercase">Loading neural state...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col relative" data-name="chat-interface">
      {/* Top App Bar */}
      <header className="h-16 flex justify-between items-center px-6 md:px-12 bg-[#0c1324]/40 backdrop-blur-xl border-b border-outline-variant/20 z-50 shrink-0">
        <div className="flex items-center gap-6">
          {/* Mobile menu button */}
          <button onClick={toggleSidebar} className="md:hidden p-2 -ml-2 text-slate-400 hover:text-[#00f5ff] transition-colors">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <h1 className="font-['Manrope'] font-black tracking-widest text-[#00f5ff] text-base md:text-lg">SENTIENT MONOLITH</h1>
          <div className="hidden md:flex gap-6">
            <span className={`font-['Space_Grotesk'] tracking-[0.2em] text-xs cursor-default ${
              !sessionId ? 'text-[#00f5ff] border-b border-[#00f5ff] pb-1' : 'text-slate-400 hover:text-primary transition-colors cursor-pointer'
            }`}>WORKSPACE</span>
            <span className={`font-['Space_Grotesk'] tracking-[0.2em] text-xs cursor-pointer ${
              sessionId ? 'text-[#00f5ff] border-b border-[#00f5ff] pb-1' : 'text-slate-400 hover:text-primary transition-colors'
            }`}>CHAT</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-primary">
          <div className="hidden md:flex gap-2 mr-4 border-r border-outline-variant/20 pr-4">
            <span className="font-['Space_Grotesk'] text-[10px] tracking-widest text-slate-500">NEURAL</span>
            <span className="font-['Space_Grotesk'] text-[10px] tracking-widest text-slate-300">/</span>
            <span className="font-['Space_Grotesk'] text-[10px] tracking-widest text-slate-300">v4.0</span>
          </div>
          <button onClick={onGoHome} className="hover:bg-white/5 p-2 rounded-full transition-colors duration-200" title="Home">
            <span className="material-symbols-outlined">home</span>
          </button>
          <button className="hover:bg-white/5 p-2 rounded-full transition-colors duration-200">
            <span className="material-symbols-outlined">account_tree</span>
          </button>
          <button className="hover:bg-white/5 p-2 rounded-full transition-colors duration-200">
            <span className="material-symbols-outlined">sensors</span>
          </button>
        </div>
      </header>

      {/* Chat Canvas */}
      <section className="flex-1 overflow-y-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto w-full flex flex-col min-h-full">

          {messages.length === 0 && !sessionId ? (
            /* Welcome / Hero Screen */
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-10 py-12">
              {/* Hero Header */}
              <div className="space-y-4">
                <p className="font-['Space_Grotesk'] text-primary-container text-xs tracking-[0.4em] uppercase opacity-70">Neural Architecture v4.0</p>
                <h2 className="font-['Manrope'] font-extrabold text-5xl md:text-7xl text-primary leading-tight tracking-tighter text-glow-primary uppercase">
                  How can I help<br/>you code today?
                </h2>
              </div>

              {/* Suggested Prompt Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                {promptCards.map((card, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(card.title)}
                    className={`group relative flex flex-col items-start p-6 bg-surface-container-low/40 backdrop-blur-md border border-outline-variant/10 rounded-xl ${card.hoverShadow} ${card.hoverBorder} hover:bg-surface-container-high transition-all duration-500 text-left overflow-hidden`}
                  >
                    <span className={`material-symbols-outlined ${card.iconColor} mb-4 opacity-60 group-hover:opacity-100 transition-opacity`}>{card.icon}</span>
                    <p className="font-['Space_Grotesk'] text-xs tracking-widest text-slate-500 uppercase mb-1">{card.label}</p>
                    <h3 className="font-['Manrope'] font-bold text-on-surface text-lg">{card.title}</h3>
                    <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-700`}></div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages */
            <div className="flex-1 py-6 space-y-1">
              {messages.map((msg, idx) => (
                <MessageItem
                  key={idx}
                  message={msg}
                  language={language}
                  isLast={idx === messages.length - 1}
                />
              ))}
              {isLoading && (
                <div className="flex justify-start mb-6 w-full py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-surface-container-high flex-shrink-0 flex items-center justify-center border border-outline-variant/20">
                      <span className="material-symbols-outlined text-[#00f5ff]" style={{fontSize: '18px'}}>psychology</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-[#00f5ff] rounded-full typing-dot"></div>
                      <div className="w-2 h-2 bg-[#00f5ff] rounded-full typing-dot"></div>
                      <div className="w-2 h-2 bg-[#00f5ff] rounded-full typing-dot"></div>
                      <span className="font-['Space_Grotesk'] text-[10px] tracking-widest text-slate-600 uppercase ml-2">Processing...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>
      </section>

      {/* Floating Bottom Input Area */}
      <div className="shrink-0 px-4 md:px-12 pb-6 pt-2 z-40">
        <div className="w-full max-w-4xl mx-auto relative group flex flex-col gap-2">
          
          {/* Attachment Previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-2">
              {attachments.map((att, idx) => (
                <div key={idx} className="relative group/att">
                  {att.mimeType?.startsWith('image/') ? (
                    <img src={att.data} alt="attachment" className="w-16 h-16 object-cover rounded-lg border border-outline-variant/30" />
                  ) : (
                    <div className="w-16 h-16 bg-surface-container-high rounded-lg flex flex-col items-center justify-center border border-outline-variant/30">
                      <span className="material-symbols-outlined text-xs text-slate-400">description</span>
                      <span className="text-[8px] font-['Space_Grotesk'] text-slate-500 truncate w-12 text-center mt-1">{att.name}</span>
                    </div>
                  )}
                  <button onClick={() => removeAttachment(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-lg opacity-0 group-hover/att:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>close</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Glass Background Glow */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary-container/20 to-secondary/20 rounded-xl blur-xl opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <div className="relative bg-surface-container-lowest/80 backdrop-blur-2xl border border-outline-variant/20 rounded-xl shadow-2xl flex items-center p-2 pl-6 gap-4">
              <span className="material-symbols-outlined text-primary-container/50">bolt</span>
              <input
                value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-primary font-body text-sm placeholder:text-slate-600"
              placeholder={t.typePlaceholder || "Initialize a new codebase or ask for logic..."}
              type="text"
            />
            <input type="file" ref={fileInputRef} hidden onChange={handleFileSelect} accept="image/*,.pdf,.txt,.js,.py,.json" multiple />
            <div className="flex items-center gap-2 pr-2">
              <button 
                onClick={toggleRecording}
                className={`p-2 transition-colors flex items-center justify-center rounded-full ${
                  isRecording 
                    ? 'bg-red-500/20 text-red-500 animate-pulse' 
                    : isTranscribing
                      ? 'text-[#00f5ff] opacity-50 cursor-wait'
                      : 'text-slate-500 hover:text-primary hover:bg-surface-container-high'
                }`}
                disabled={isTranscribing}
                title="Speech to Text"
              >
                <span className="material-symbols-outlined">{isRecording ? 'stop_circle' : 'mic'}</span>
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-500 hover:text-primary transition-colors disabled:opacity-50"
                disabled={attachments.length >= 4}
                title="Attach files (Max 4)"
              >
                <span className="material-symbols-outlined">attachment</span>
              </button>
              <button
                onClick={handleSend}
                disabled={(!input.trim() && attachments.length === 0) || isLoading}
                className={`font-['Space_Grotesk'] font-bold text-[10px] tracking-widest uppercase px-6 py-2.5 rounded-lg shadow-lg transition-all active:scale-95 ${
                  (input.trim() || attachments.length > 0) && !isLoading
                    ? 'bg-gradient-to-br from-primary to-primary-container text-on-primary hover:brightness-110'
                    : 'bg-surface-container-high text-slate-600 cursor-not-allowed'
                }`}
              >
                GENERATE
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Status Metadata Footer */}
      <div className="hidden md:flex shrink-0 px-8 pb-3 items-center justify-end gap-6 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot"></div>
          <span className="font-['Space_Grotesk'] text-[9px] tracking-[0.2em] text-slate-400 uppercase">System Core Active</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-['Space_Grotesk'] text-[9px] tracking-[0.2em] text-slate-600 uppercase">Neural Engine v4.0</span>
        </div>
      </div>
    </main>
  );
}