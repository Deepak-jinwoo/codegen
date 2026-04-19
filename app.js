// Important: DO NOT remove this `ErrorBoundary` component.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h1>
            <p className="text-gray-600 mb-4">We're sorry, but something unexpected happened.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  try {
    const [sidebarOpen, setSidebarOpen] = React.useState(false);
    const [language, setLanguage] = React.useState('en');
    const [sessions, setSessions] = React.useState([]);
    const [currentSessionId, setCurrentSessionId] = React.useState(null);
    const [isLoadingSessions, setIsLoadingSessions] = React.useState(true);
    const [theme, setTheme] = React.useState(() => localStorage.getItem('theme') || 'dark');
    const [showToast, setShowToast] = React.useState(null);
    const [currentUser, setCurrentUser] = React.useState(() => {
        const saved = localStorage.getItem('currentUser');
        return saved ? JSON.parse(saved) : null;
    });
    const [skillLevel, setSkillLevel] = React.useState(() => {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            const parsed = JSON.parse(savedUser);
            return localStorage.getItem('skillLevel_' + parsed.email) || null;
        }
        return null;
    });

    const handleSelectSkillLevel = (level) => {
        setSkillLevel(level);
        if (currentUser) {
            localStorage.setItem('skillLevel_' + currentUser.email, level);
        }
    };

    // Firebase Auth — listen for login state changes
    React.useEffect(() => {
        const unsubscribe = firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    const syncRes = await fetch('/api/auth/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uid: user.uid, email: user.email })
                    });
                    if (syncRes.ok) {
                        const sqliteUser = await syncRes.json();
                        const fullUser = { ...sqliteUser, photoURL: user.photoURL, displayName: user.displayName };
                        setCurrentUser(fullUser);
                        localStorage.setItem('currentUser', JSON.stringify(fullUser));
                    }
                } catch (err) {
                    console.error('Auth sync error:', err);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // Handle theme class on root element
    React.useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
        } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Initial load of sessions
    React.useEffect(() => {
        if (currentUser) {
            loadSessions();
        }
    }, [currentUser]);

    const loadSessions = async () => {
        setIsLoadingSessions(true);
        try {
            const fetchedSessions = await getSessions();
            setSessions(fetchedSessions);
            
            // If no sessions exist, create one automatically or leave it empty to show welcome screen
            if (fetchedSessions.length > 0 && !currentSessionId) {
                // Optional: Auto-select latest? For now let's keep it null to show "New Chat" screen
                // setCurrentSessionId(fetchedSessions[0].objectId);
            }
        } catch (error) {
            console.error("Failed to load sessions", error);
        } finally {
            setIsLoadingSessions(false);
        }
    };

    const handleNewChat = async () => {
        // We don't create the session in DB immediately to avoid empty sessions.
        // We just clear the currentSessionId, and ChatInterface will handle creation on first message.
        setCurrentSessionId(null);
        if (window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    };

    const handleSelectChat = (sessionId) => {
        setCurrentSessionId(sessionId);
        // Find session language if possible
        const session = sessions.find(s => s.objectId === sessionId);
        if (session && session.objectData.language) {
            setLanguage(session.objectData.language);
        }
        if (window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    };

    // Callback when a new session is actually created in the DB by ChatInterface
    const onSessionCreated = (newSession) => {
        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newSession.objectId);
    };

    // Callback when session title is updated
    const onSessionUpdated = (sessionId, newTitle) => {
        setSessions(prev => prev.map(s => 
            s.objectId === sessionId 
                ? { ...s, objectData: { ...s.objectData, title: newTitle } } 
                : s
        ));
    };



    const handleLogout = () => {
        // Clear state immediately — don't depend on Firebase signOut succeeding
        setCurrentUser(null);
        setSkillLevel(null);
        localStorage.removeItem('currentUser');
        setSessions([]);
        setCurrentSessionId(null);
        
        // Show logout toast
        setShowToast('Logged out successfully');
        setTimeout(() => setShowToast(null), 2500);

        // Also sign out from Firebase Auth (fire-and-forget)
        try {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                firebase.auth().signOut().catch(() => {});
            }
        } catch (e) {
            // Ignore — state is already cleared
        }
    };

    const handleGoogleLogin = async () => {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await firebase.auth().signInWithPopup(provider);
            const user = result.user;
            
            const syncRes = await fetch('/api/auth/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid, email: user.email })
            });
            if (syncRes.ok) {
                const sqliteUser = await syncRes.json();
                const fullUser = { ...sqliteUser, photoURL: user.photoURL, displayName: user.displayName };
                setCurrentUser(fullUser);
                localStorage.setItem('currentUser', JSON.stringify(fullUser));
                setShowToast(`Welcome, ${user.displayName || user.email}!`);
                setTimeout(() => setShowToast(null), 3000);
            }
        } catch (error) {
            console.error('Google Auth Error:', error.code, error.message);
            if (error.code === 'auth/unauthorized-domain') {
                alert('This domain is not authorized. Add it in Firebase Console > Authentication > Settings > Authorized domains.');
            } else if (error.code === 'auth/popup-closed-by-user') {
                // User closed the popup, no error needed
            } else {
                alert('Sign-in failed: ' + (error.message || 'Unknown error'));
            }
        }
    };

    const handleDeleteChat = async (sessionId) => {
        try {
            await deleteSession(sessionId);
            setSessions(prev => prev.filter(s => s.objectId !== sessionId));
            if (currentSessionId === sessionId) {
                setCurrentSessionId(null);
            }
        } catch (error) {
            console.error('Failed to delete session:', error);
        }
    };

    // Email/password login handler (for Login.js form)
    const handleEmailLogin = (user) => {
        const fullUser = { ...user, photoURL: null, displayName: user.email };
        setCurrentUser(fullUser);
        localStorage.setItem('currentUser', JSON.stringify(fullUser));
        setShowToast(`Welcome, ${user.email}!`);
        setTimeout(() => setShowToast(null), 3000);
    };

    // If not logged in, show login page
    if (!currentUser) {
      return (
        <div className="relative" data-name="app" data-file="app.js">
          {/* Toast */}
          {showToast && (
            <div className="fixed top-6 right-4 z-[9999] bg-surface-container-high border border-[#00f5ff]/30 text-primary px-6 py-3 rounded-xl shadow-[0_0_20px_rgba(0,245,255,0.1)] font-['Manrope'] font-bold text-sm animate-[fadeInDown_0.3s_ease-out]">
              {showToast}
            </div>
          )}
          <Login onLogin={handleEmailLogin} />
        </div>
      );
    }

    return (
      <div className="flex min-w-0 h-[100dvh] w-full max-w-full overflow-hidden bg-surface relative z-10" data-name="app" data-file="app.js">
        
        {/* Welcome Toast Notification */}
        {showToast && (
            <div className="fixed top-20 right-4 z-[9999] bg-surface-container-high border border-[#00f5ff]/30 text-primary px-6 py-3 rounded-xl shadow-[0_0_20px_rgba(0,245,255,0.1)] font-['Manrope'] font-bold text-sm shadow-xl slide-in-right animate-[fadeInDown_0.3s_ease-out]">
                {showToast}
            </div>
        )}

        {!skillLevel && currentUser && <OnboardingModal onSelect={handleSelectSkillLevel} />}
        <Sidebar 
            isOpen={sidebarOpen} 
            onClose={() => setSidebarOpen(false)}
            onNewChat={handleNewChat}
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectChat={handleSelectChat}
            onDeleteChat={handleDeleteChat}
            language={language}
            setLanguage={setLanguage}
            currentLanguage={language}
            isLoading={isLoadingSessions}
            theme={theme}
            setTheme={setTheme}
            currentUser={currentUser}
            onLogout={handleLogout}
            skillLevel={skillLevel}
            onUpdateSkillLevel={handleSelectSkillLevel}
        />
        
        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
            <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                onClick={() => setSidebarOpen(false)}
            ></div>
        )}

        <ChatInterface 
            sessionId={currentSessionId}
            language={language}
            toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onSessionCreated={onSessionCreated}
            onSessionUpdated={onSessionUpdated}
            onGoHome={handleNewChat}
            skillLevel={skillLevel}
            currentUser={currentUser}
            onLogout={handleLogout}
        />
      </div>
    );
  } catch (error) {
    console.error('App component error:', error);
    return null;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);