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
    const password = document.getElementById('password').value.trim();
    const confirm = document.getElementById('confirm').value.trim();
    const role = document.getElementById('role').value;

    if (!email || !username || !password || !confirm || !role) {
        alert('Please fill in all fields');
        return;
    }

    if (!email.includes('@') || !email.includes('.')) {
        alert('Please enter a valid email address');
        return;
    }

    if (username.length < 3) {
        alert('Username must be at least 3 characters');
        return;
    }

    if (password.length < 4) {
        alert('Password must be at least 4 characters');
        return;
    }

    if (password !== confirm) {
        alert('Passwords do not match');
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

            alert('Registration successful! You can now log in.');

            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            alert(data.error || 'Registration failed');
        }
    } catch (error) {
        alert('Registration failed. Make sure the server is running.');
        console.error('Error during registration request:', error);
    }
});
