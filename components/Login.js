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
    <div 
      className="min-h-screen flex items-center justify-center relative z-50 p-4" 
      data-name="login-screen"
      style={{ background: '#0a0f1e' }}
    >
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(0,220,229,0.08), transparent 60%)' }}></div>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 80% 50%, rgba(87,27,193,0.08), transparent 60%)' }}></div>
      </div>
      <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.03]">
        <div className="w-full h-full" style={{ backgroundImage: "radial-gradient(#63f7ff 0.5px, transparent 0.5px)", backgroundSize: "40px 40px" }}></div>
      </div>

      <div 
        className="w-full max-w-md backdrop-blur-2xl rounded-2xl p-8 relative z-10"
        style={{ 
          background: 'rgba(12, 19, 36, 0.92)', 
          border: '1px solid rgba(0, 245, 255, 0.12)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(0,245,255,0.05)'
        }}
      >
        {/* Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <span className="material-symbols-outlined mb-4" style={{ fontSize: '48px', color: '#00f5ff' }}>terminal</span>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 900, letterSpacing: '0.15em', color: '#00f5ff', fontSize: '1.5rem', textAlign: 'center' }}>CODEGEN</h1>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#64748b', fontSize: '0.7rem', letterSpacing: '0.25em', textTransform: 'uppercase', marginTop: '0.5rem' }}>Neural Authentication</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ 
            background: 'rgba(239,68,68,0.1)', 
            border: '1px solid rgba(239,68,68,0.3)', 
            color: '#f87171', 
            fontSize: '0.875rem', 
            fontFamily: 'Space Grotesk, sans-serif',
            padding: '0.75rem', 
            borderRadius: '0.5rem', 
            marginBottom: '1.5rem', 
            textAlign: 'center' 
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Email Field */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ 
              display: 'block', 
              fontFamily: 'Space Grotesk, sans-serif', 
              fontSize: '0.7rem', 
              color: '#94a3b8', 
              textTransform: 'uppercase', 
              letterSpacing: '0.15em', 
              marginBottom: '0.5rem' 
            }}>
              Email Address
            </label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ 
                width: '100%', 
                background: '#1a2137', 
                border: '1px solid rgba(100,116,139,0.3)', 
                borderRadius: '0.5rem', 
                padding: '0.75rem 1rem', 
                color: '#e2e8f0',
                fontSize: '0.875rem',
                fontFamily: 'Inter, sans-serif',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => { 
                e.target.style.borderColor = 'rgba(0,245,255,0.5)'; 
                e.target.style.boxShadow = '0 0 0 3px rgba(0,245,255,0.1), 0 0 15px rgba(0,245,255,0.08)'; 
              }}
              onBlur={(e) => { 
                e.target.style.borderColor = 'rgba(100,116,139,0.3)'; 
                e.target.style.boxShadow = 'none'; 
              }}
              placeholder="operator@monolith.ai"
              required
            />
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              fontFamily: 'Space Grotesk, sans-serif', 
              fontSize: '0.7rem', 
              color: '#94a3b8', 
              textTransform: 'uppercase', 
              letterSpacing: '0.15em', 
              marginBottom: '0.5rem' 
            }}>
              Access Code
            </label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ 
                width: '100%', 
                background: '#1a2137', 
                border: '1px solid rgba(100,116,139,0.3)', 
                borderRadius: '0.5rem', 
                padding: '0.75rem 1rem', 
                color: '#e2e8f0',
                fontSize: '0.875rem',
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '0.2em',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => { 
                e.target.style.borderColor = 'rgba(0,245,255,0.5)'; 
                e.target.style.boxShadow = '0 0 0 3px rgba(0,245,255,0.1), 0 0 15px rgba(0,245,255,0.08)'; 
              }}
              onBlur={(e) => { 
                e.target.style.borderColor = 'rgba(100,116,139,0.3)'; 
                e.target.style.boxShadow = 'none'; 
              }}
              placeholder="••••••••"
              required
            />
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={isLoading}
            style={{ 
              width: '100%', 
              fontFamily: 'Space Grotesk, sans-serif', 
              fontWeight: 700, 
              fontSize: '0.7rem', 
              letterSpacing: '0.2em', 
              textTransform: 'uppercase', 
              padding: '0.9rem', 
              borderRadius: '0.5rem', 
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              background: isLoading ? '#23293c' : 'linear-gradient(to right, #00dce5, #00f5ff)',
              color: isLoading ? '#64748b' : '#003739',
              boxShadow: isLoading ? 'none' : '0 0 20px rgba(0,245,255,0.15)'
            }}
            onMouseEnter={(e) => { if (!isLoading) e.target.style.boxShadow = '0 0 25px rgba(0,245,255,0.4)'; }}
            onMouseLeave={(e) => { if (!isLoading) e.target.style.boxShadow = '0 0 20px rgba(0,245,255,0.15)'; }}
          >
            {isLoading ? 'Processing...' : isRegister ? 'Initialize Protocol' : 'Establish Connection'}
          </button>
        </form>

        {/* Toggle Register/Login */}
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button 
            type="button"
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            style={{ 
              background: 'none', 
              border: 'none', 
              fontFamily: 'Space Grotesk, sans-serif', 
              fontSize: '0.7rem', 
              color: '#00f5ff', 
              cursor: 'pointer', 
              letterSpacing: '0.1em', 
              textTransform: 'uppercase',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.color = '#ffffff'}
            onMouseLeave={(e) => e.target.style.color = '#00f5ff'}
          >
            {isRegister ? 'Already have access? Proceed to login' : 'Request neural initialization'}
          </button>
        </div>
      </div>
    </div>
  );
}
