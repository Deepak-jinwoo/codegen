function OnboardingModal({ onSelect }) {
  const options = [
    {
      id: 'newbie',
      icon: 'school',
      title: 'New to Coding',
      desc: 'I am starting from scratch. Explain everything step-by-step.',
      color: 'from-blue-500 to-cyan-400'
    },
    {
      id: 'beginner',
      icon: 'code',
      title: 'Beginner',
      desc: 'I know some basics. Need examples with moderate explanations.',
      color: 'from-emerald-400 to-teal-400'
    },
    {
      id: 'intermediate',
      icon: 'architecture',
      title: 'Intermediate',
      desc: 'Focus on logic, architecture, and optimization. Less syntax talk.',
      color: 'from-purple-500 to-indigo-500'
    },
    {
      id: 'practice',
      icon: 'psychology',
      title: 'Practice / Interview',
      desc: 'Test me! Act as an interviewer. Give problems and minimal hints.',
      color: 'from-orange-500 to-red-500'
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0c1324]/80 backdrop-blur-md px-4 py-8">
      <div className="bg-surface-container-lowest border border-[#00f5ff]/20 shadow-[0_0_50px_rgba(0,245,255,0.1)] rounded-2xl w-full max-w-2xl overflow-hidden animate-[fadeInDown_0.4s_ease-out]">
        
        {/* Header */}
        <div className="p-6 md:p-8 text-center border-b border-outline-variant/20 bg-gradient-to-b from-[#00f5ff]/10 to-transparent">
          <div className="inline-flex items-center justify-center p-3 bg-[#00f5ff]/20 rounded-full mb-4 ring-4 ring-[#00f5ff]/10">
            <span className="material-symbols-outlined text-[#00f5ff] text-3xl">tune</span>
          </div>
          <h2 className="font-['Manrope'] font-extrabold text-2xl md:text-3xl text-primary mb-2">Configure AI Neural Sync</h2>
          <p className="font-['Space_Grotesk'] text-slate-400 text-sm tracking-wide">
            Select your skill level to tune the AI’s response style, complexity, and verbosity.
          </p>
        </div>

        {/* Options Grid */}
        <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onSelect(opt.id)}
              className="group relative flex flex-col items-start p-5 bg-surface-container-low border border-outline-variant/30 rounded-xl hover:border-[#00f5ff]/50 hover:bg-surface-container transition-all duration-300 text-left overflow-hidden hover:-translate-y-1"
            >
              {/* Hover Glow Background */}
              <div className={`absolute -inset-2 bg-gradient-to-br ${opt.color} opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-500`}></div>
              
              <div className="flex items-center gap-3 mb-3 relative z-10 w-full">
                <span className={`material-symbols-outlined bg-gradient-to-br ${opt.color} bg-clip-text text-transparent`} style={{ fontSize: '28px' }}>
                  {opt.icon}
                </span>
                <h3 className="font-['Manrope'] font-bold text-primary group-hover:text-[#00f5ff] transition-colors">
                  {opt.title}
                </h3>
              </div>
              <p className="font-['Inter'] text-xs text-slate-400 leading-relaxed relative z-10">
                {opt.desc}
              </p>
            </button>
          ))}
        </div>
        
        {/* Footer info */}
        <div className="px-6 py-4 bg-surface-container-low/50 text-center text-xs text-slate-500 border-t border-outline-variant/20 font-['Space_Grotesk'] tracking-widest uppercase">
          You can change this later in Settings.
        </div>
      </div>
      
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
