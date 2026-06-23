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

       document.getElementById('loginBtn').addEventListener('click', async () => {
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();

            if (!username || !password) {
                showNotification('Please enter both username and password', 'warning');
                return;
            }

            try {
                const response = await fetchWithTimeout('http://localhost:4001/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();
                
                if (response.ok && data.success) {
                    saveOfflineUser(username, password);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    showNotification(`Login successful! Welcome ${data.user.username} (${data.user.role})`, 'successs');
                    window.location.href = 'dashboard.html';
                } else {
                    showNotification(data.error || 'Login failed', 'error');
                }
            } catch (error) {
                const results = offlineLogin(username, password);

                if (results.success) {
                    showNotification('Offline login successful', 'success');
                    window.location.href = 'dashboard.html';
                    return;
                }

                showNotification('Online login is unavailable...', 'warning');
                console.error(error);
            }
        });
        
        document.getElementById('password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('loginBtn').click();
            }
        });
