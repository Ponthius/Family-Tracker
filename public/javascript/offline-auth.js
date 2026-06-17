// offline-auth.js

function saveOfflineUser(username, password) {
    const userData = {
        username,
        password,
        savedAt: new Date().toISOString()
    };

    localStorage.setItem('offlineUser', JSON.stringify(userData));
    return userData;
}

function getOfflineUser() {
    const stored = localStorage.getItem('offlineUser');
    if (!stored) return null;

    try {
        return JSON.parse(stored);
    } catch (error) {
        return null;
    }
}

function offlineLogin(username, password) {
    const user = getOfflineUser();

    if (!user) {
        return {
            success: false,
            message: 'Internet connection required for first login.'
        };
    }

    if (
        user.username === username &&
        user.password === password
    ) {
        localStorage.setItem('user', JSON.stringify({
            username: user.username,
            savedAt: user.savedAt
        }));

        return {
            success: true,
            user: {
                username: user.username
            }
        };
    }

    return {
        success: false,
        message: 'Invalid credentials.'
    };
}