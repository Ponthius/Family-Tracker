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
                showNotification("Please fill in all fields", "warning");

                return;
            }
            
            if (!email.includes('@') || !email.includes('.')) {
                showNotification("Please enter a valid email address", "warning");

                return;
            }
            
            if (username.length < 3) {
                showNotification("Username must be at least 3 characters", "warning");

                return;
            }
            
            if (password.length < 4) {
                showNotification('Password must be at least 4 characters');
                return;
            }
            
            if (password !== confirm) {
                showNotification("Passwords do not match", "error");

                return;
            }

            try {
                const response = await fetchWithTimeout('http://localhost:4001/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, username, password, role })
                });

                const data = await response.json();
                
                if (response.ok && data.success) {
                    saveOfflineUser(username, password);
                    saveRegisteredUser({ email, username, role });
                    showNotification("Registration successful! Please login.", "success");

                    window.location.href = 'login.html';
                } else {
                    showNotification(data.error || 'Registration failed', 'error');

                }
            } catch (error) {
                showNotification('Online registration is unavailable. Start the server, then try again', 'warning');

                console.error('Error during registration request:', 'error');
            }
        });
