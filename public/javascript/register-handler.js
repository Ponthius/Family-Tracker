async function fetchWithTimeout(url, options = {}, timeout = 5000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } finally {
        clearTimeout(timer);
    }
}

document.getElementById('registerBtn').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const username = document.getElementById('username').value.trim();
    const [REDACTED:KEYVALUE]('password').value.trim();
    const confirm = document.getElementById('confirm').value.trim();
    const role = document.getElementById('role').value;

    if (!email || !username || !password || !confirm || !role) {
        showToast('Please fill in all fields', 'warning');
        return;
    }

    if (!email.includes('@') || !email.includes('.')) {
        showToast('Please enter a valid email address', 'warning');
        return;
    }

    if (username.length < 3) {
        showToast('Username must be at least 3 characters', 'warning');
        return;
    }

    if (password.length < 4) {
        showToast('Password must be at least 4 characters', 'warning');
        return;
    }

    if (password !== confirm) {
        showToast('Passwords do not match', 'error');
        return;
    }

    try {
        const response = await fetchWithTimeout('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username, password, role })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            saveRegisteredUser({ email, username, role });

            showToast('Registration successful! You can now log in.', 'success');

            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showToast('Registration failed. Make sure the server is running.', 'error');
        console.error('Error during registration request:', error);
    }
});
