function Sidebar({ isOpen, onClose, onNewChat, sessions, currentSessionId, onSelectChat, language, setLanguage, currentLanguage, isLoading }) {
  const t = TRANSLATIONS[currentLanguage];

  const languages = ['en', 'ta', 'ru', 'ja'];

  const cycleLanguage = () => {
    const currentIndex = languages.indexOf(currentLanguage);
    const nextIndex = (currentIndex + 1) % languages.length;
    setLanguage(languages[nextIndex]);
  };

  const navItems = [
    { icon: 'terminal', label: 'Terminal', active: true },
    { icon: 'psychology', label: 'Neural', active: false },
    { icon: 'history', label: 'History', active: false },
    { icon: 'settings', label: 'Settings', active: false },
  ];

  return (
    <>
      {/* Icon Rail Sidebar (Desktop) */}
      <aside
        className={`
          hidden md:flex w-20 h-screen border-r border-outline-variant/20 bg-[#0c1324] flex-col items-center py-8 gap-8 shadow-[0_0_40px_rgba(0,220,229,0.1)] shrink-0 relative z-30
        `}
        data-name="sidebar-rail"
      >
        {/* Logo */}
        <div className="text-[#00f5ff] font-bold tracking-tighter text-xl mb-4">
          <span className="material-symbols-outlined" style={{fontSize: '28px'}}>terminal</span>
        </div>

        {/* Nav Items */}
        <nav className="flex flex-col gap-6">
          {navItems.map((item, idx) => (
            <button
              key={idx}
              className={`w-12 h-12 flex flex-col items-center justify-center gap-1 rounded-lg transition-all duration-300 scale-95 active:scale-90 ${
                item.active
                  ? 'text-[#00f5ff] bg-[#23293c] shadow-[inset_0_0_10px_rgba(0,245,255,0.2)]'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-[#23293c]'
              }`}
              onClick={item.label === 'History' ? () => {/* Could toggle history panel */} : undefined}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-['Space_Grotesk'] text-[10px] tracking-widest uppercase">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Profile at bottom */}
        <div className="mt-auto">
          <div
            className="w-10 h-10 rounded-full border border-outline-variant/30 flex items-center justify-center bg-surface-container overflow-hidden cursor-pointer hover:border-[#00f5ff]/50 transition-colors"
            onClick={cycleLanguage}
            title={`Language: ${t.langName} — Click to change`}
          >
            <span className="font-['Space_Grotesk'] text-xs font-bold text-[#00f5ff] uppercase">{currentLanguage}</span>
          </div>
        </div>
      </aside>

      {/* Slide-out History Panel (Desktop - triggered by clicking History icon) */}

      {/* Mobile Sidebar Overlay */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-[#0c1324]/95 backdrop-blur-2xl border-r border-outline-variant/20 transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:hidden flex flex-col
        `}
        data-name="sidebar-mobile"
      >
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#00f5ff]">terminal</span>
            <h1 className="font-['Manrope'] font-black tracking-widest text-[#00f5ff] text-lg">MONOLITH</h1>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-primary transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* New Chat Button */}
        <div className="px-4 py-4">
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-3 px-4 py-3 bg-surface-container-low/60 border border-outline-variant/20 rounded-xl hover:bg-surface-container-high hover:border-[#00f5ff]/20 transition-all duration-300 text-sm font-medium text-primary"
          >
            <span className="material-symbols-outlined text-[#00f5ff]">add_circle</span>
            <span className="font-['Space_Grotesk'] tracking-widest text-xs uppercase">{t.newChat}</span>
          </button>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#00f5ff]/30 border-t-[#00f5ff] rounded-full animate-spin"></div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-slate-600 mb-2" style={{fontSize: '32px'}}>chat_bubble_outline</span>
              <p className="font-['Space_Grotesk'] text-xs text-slate-600 tracking-widest uppercase">No history yet</p>
            </div>
          ) : (
            <>
              <div className="px-3 py-2 text-[10px] font-['Space_Grotesk'] tracking-[0.2em] text-slate-600 uppercase">
                Recent Sessions
              </div>
              {sessions.map(session => (
                <button
                  key={session.objectId}
                  onClick={() => onSelectChat(session.objectId)}
                  className={`w-full text-left px-4 py-2.5 text-sm rounded-lg truncate transition-all duration-200 flex items-center gap-3 group ${
                    currentSessionId === session.objectId
                      ? 'bg-[#23293c] text-[#00f5ff] shadow-[inset_0_0_10px_rgba(0,245,255,0.1)]'
                      : 'text-slate-400 hover:bg-surface-container-high hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm" style={{fontSize: '16px'}}>
                    {currentSessionId === session.objectId ? 'chat' : 'chat_bubble_outline'}
                  </span>
                  <span className="truncate font-['Inter'] text-xs">{session.objectData.title || 'New Chat'}</span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Footer Controls */}
        <div className="p-4 border-t border-outline-variant/20 space-y-2">
          {/* Language Selector */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface-container-high group cursor-pointer transition-colors" onClick={cycleLanguage}>
            <div className="flex items-center gap-2 text-sm text-primary">
              <span className="material-symbols-outlined" style={{fontSize: '18px'}}>translate</span>
              <span className="font-['Space_Grotesk'] text-xs">{t.langName}</span>
            </div>
            <div className="text-[#00f5ff] text-[10px] font-['Space_Grotesk'] tracking-widest border border-outline-variant/30 px-2 py-0.5 rounded uppercase">
              {currentLanguage}
            </div>
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-container-high cursor-pointer transition-colors">
            <div className="w-8 h-8 rounded-full border border-outline-variant/30 flex items-center justify-center bg-secondary-container text-white text-xs font-bold">
              U
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-primary truncate font-['Space_Grotesk']">User</div>
              <div className="text-[10px] text-slate-600 truncate font-['Space_Grotesk'] tracking-wider">NEURAL ACCESS</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}