function Login({ onLogin }) {
  const [isRegister, setIsRegister] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill out all fields.');
      return;
    }
    setIsLoading(true);
    setError('');
    
    try {
      let data;
      if (isRegister) {
        data = await registerUser(email, password);
      } else {
        data = await loginUser(email, password);
      }
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface relative z-50 p-4" data-name="login-screen">
      <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 light-leak-cyan"></div>
          <div className="absolute inset-0 light-leak-violet"></div>
      </div>
      <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.03]">
          <div className="w-full h-full" style={{ backgroundImage: "radial-gradient(#63f7ff 0.5px, transparent 0.5px)", backgroundSize: "40px 40px" }}></div>
      </div>

      <div className="w-full max-w-md bg-[#0c1324]/80 backdrop-blur-2xl border border-outline-variant/30 rounded-2xl p-8 relative z-10 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <span className="material-symbols-outlined text-[#00f5ff] mb-4" style={{ fontSize: '48px' }}>terminal</span>
          <h1 className="font-['Manrope'] font-black tracking-widest text-[#00f5ff] text-2xl text-center">SENTIENT MONOLITH</h1>
          <p className="font-['Space_Grotesk'] text-slate-400 text-xs tracking-widest uppercase mt-2">Neural Authentication</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-['Space_Grotesk'] p-3 rounded-lg mb-6 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block font-['Space_Grotesk'] text-xs text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#151b2d] border border-outline-variant/30 rounded-lg px-4 py-3 text-primary focus:outline-none focus:border-[#00f5ff]/50 transition-colors font-body text-sm"
              placeholder="operator@monolith.ai"
              required
            />
          </div>
          <div>
            <label className="block font-['Space_Grotesk'] text-xs text-slate-400 uppercase tracking-wider mb-2">Access Code</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#151b2d] border border-outline-variant/30 rounded-lg px-4 py-3 text-primary focus:outline-none focus:border-[#00f5ff]/50 transition-colors font-body text-sm tracking-widest"
              placeholder="••••••••"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className={`w-full font-['Space_Grotesk'] font-bold text-xs tracking-widest uppercase py-3.5 rounded-lg transition-all ${isLoading ? 'bg-[#23293c] text-slate-500' : 'bg-gradient-to-r from-[#00dce5] to-[#00f5ff] text-[#003739] hover:shadow-[0_0_20px_rgba(0,245,255,0.4)] hover:brightness-110 active:scale-95'}`}
          >
            {isLoading ? 'Processing...' : isRegister ? 'Initialize Protocol' : 'Establish Connection'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            type="button"
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="font-['Space_Grotesk'] text-xs text-[#00f5ff] hover:text-white transition-colors tracking-wider uppercase"
          >
            {isRegister ? 'Already have access? Proceed to login' : 'Request neural initialization'}
          </button>
        </div>
      </div>
    </div>
  );
}
