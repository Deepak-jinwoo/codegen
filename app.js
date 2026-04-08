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
    const [currentUser, setCurrentUser] = React.useState(() => {
        const saved = localStorage.getItem('currentUser');
        return saved ? JSON.parse(saved) : null;
    });

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

    if (!currentUser) {
        return <Login onLogin={(user) => { setCurrentUser(user); localStorage.setItem('currentUser', JSON.stringify(user)); }} />;
    }

    const handleLogout = () => {
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
        setSessions([]);
        setCurrentSessionId(null);
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

    return (
      <div className="flex h-screen overflow-hidden bg-surface relative z-10" data-name="app" data-file="app.js">
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