/**
 * Database helper functions — Local Backend API version
 * 
 * Replaces the Trickle SDK globals (trickleCreateObject, trickleListObjects, etc.)
 * with fetch() calls to our local Express server.
 */
const API_BASE = window.location.port !== '3000' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000' : window.location.origin;
const DB_TABLES = {
    SESSIONS: 'chat_sessions',
    MESSAGES: 'chat_messages'
};

// Create a new chat session
async function createSession(title, language) {
    try {
        const userStr = localStorage.getItem('currentUser');
        const user = userStr ? JSON.parse(userStr) : null;
        const userId = user ? user.id : null;

        const response = await fetch(`${API_BASE}/api/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title || 'New Chat', language: language || 'en', userId })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const session = await response.json();
        return session;
    } catch (error) {
        console.error('Error creating session:', error);
        throw error;
    }
}

// Get all chat sessions (ordered by latest first)
async function getSessions() {
    try {
        const userStr = localStorage.getItem('currentUser');
        const user = userStr ? JSON.parse(userStr) : null;
        let query = user ? `?userId=${user.id}` : '';

        const response = await fetch(`${API_BASE}/api/sessions${query}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        return result.items || [];
    } catch (error) {
        console.error('Error fetching sessions:', error);
        return [];
    }
}

// Get messages for a specific session
async function getMessages(sessionId) {
    try {
        const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        return result.items || [];
    } catch (error) {
        console.error('Error fetching messages:', error);
        return [];
    }
}

// Save a message to the database
async function saveMessage(sessionId, role, content, isError = false, attachments = []) {
    try {
        const response = await fetch(`${API_BASE}/api/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, role, content, isError, attachments })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const message = await response.json();
        return message;
    } catch (error) {
        console.error('Error saving message:', error);
        throw error;
    }
}

// Update session title (e.g., after first message)
async function updateSessionTitle(sessionId, title) {
    try {
        const response = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
        console.error('Error updating session title:', error);
    }
}

// Delete a session and all its messages
async function deleteSession(sessionId) {
    try {
        const response = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return true;
    } catch (error) {
        console.error('Error deleting session:', error);
        throw error;
    }
}

// ── Auth Functions ──

async function registerUser(email, password) {
    const response = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to register');
    return data;
}

async function loginUser(email, password) {
    const response = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to login');
    return data;
}