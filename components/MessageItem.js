function MessageItem({ message, isLast, language }) {
  const { role, content, isError } = message;
  const isUser = role === 'user';
  const t = TRANSLATIONS[language];
  
  // Parse content into text and code blocks
  const parsedContent = React.useMemo(() => parseMessageContent(content), [content]);

  const [copiedIndex, setCopiedIndex] = React.useState(null);

  const handleCopy = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6 group`} data-name="message-item">
      <div className={`flex max-w-[95%] md:max-w-[85%] gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center border ${
          isUser 
            ? 'bg-secondary-container border-secondary/30' 
            : 'bg-surface-container-high border-outline-variant/20'
        }`}>
          {isUser ? (
            <span className="material-symbols-outlined text-secondary" style={{fontSize: '18px'}}>person</span>
          ) : (
            <span className="material-symbols-outlined text-[#00f5ff]" style={{fontSize: '18px'}}>psychology</span>
          )}
        </div>

        {/* Content Bubble */}
        <div className={`flex flex-col min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
          <span className="font-['Space_Grotesk'] text-[10px] tracking-[0.2em] text-slate-600 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity uppercase">
            {isUser ? t.roleUser : t.roleAI}
          </span>
          
          <div className={`rounded-xl overflow-hidden w-full ${
            isUser 
              ? 'bg-surface-container-high/60 backdrop-blur-md border border-secondary/10 text-primary rounded-tr-sm px-5 py-3.5' 
              : isError 
                ? 'bg-error-container/20 text-error border border-error/20 rounded-tl-sm px-5 py-3.5'
                : 'bg-transparent text-primary p-0 shadow-none'
          }`}>
            {isUser ? (
              <p className="whitespace-pre-wrap break-words font-['Inter'] text-sm leading-relaxed">{content}</p>
            ) : (
              <div className="space-y-4 w-full min-w-0">
                {parsedContent.map((block, idx) => {
                  if (block.type === 'text') {
                    return (
                      <p key={idx} className="whitespace-pre-wrap leading-7 break-words font-['Inter'] text-sm text-on-surface/90">{block.content}</p>
                    );
                  } else {
                    // Code block
                    const isCopied = copiedIndex === idx;
                    return (
                      <div key={idx} className="rounded-xl overflow-hidden border border-outline-variant/20 my-3 w-full max-w-full shadow-lg">
                        <div className="bg-surface-container-high px-4 py-2.5 flex items-center justify-between border-b border-outline-variant/20">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#00f5ff]/60" style={{fontSize: '14px'}}>code</span>
                            <span className="text-[10px] font-['Space_Grotesk'] tracking-widest text-slate-500 uppercase">
                              {block.language}
                            </span>
                          </div>
                          <button 
                            onClick={() => handleCopy(block.content, idx)}
                            className="flex items-center gap-1.5 text-[10px] font-['Space_Grotesk'] tracking-widest text-slate-500 hover:text-[#00f5ff] transition-colors uppercase"
                          >
                            <span className="material-symbols-outlined" style={{fontSize: '14px'}}>
                              {isCopied ? 'check_circle' : 'content_copy'}
                            </span>
                            {isCopied ? t.copied : t.copy}
                          </button>
                        </div>
                        <div className="bg-[#070d1f] p-4 overflow-x-auto">
                          <pre className="text-sm font-['Space_Grotesk'] text-[#b9caca]">
                            <code>{block.content}</code>
                          </pre>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}