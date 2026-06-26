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

        function toggleRecoveryUI(message) {
            const banner = document.getElementById('recoveryBanner');
            const recoverBtn = document.getElementById('recoverBtn');
            const loginBtn = document.getElementById('loginBtn');
            if (banner) {
                banner.style.display = message ? 'block' : 'none';
                banner.textContent = message || '';
            }
            if (recoverBtn) recoverBtn.style.display = message ? 'inline-block' : 'none';
            if (loginBtn) loginBtn.style.display = message ? 'none' : 'inline-block';
        }

       document.getElementById('loginBtn').addEventListener('click', async () => {
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();

            if (!username || !password) {
                showNotification('Please enter both username and password', 'warning');
                return;
            }

            try {
                const response = await fetchWithTimeout('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();
                
                if (response.ok && data.success) {
                    saveOfflineUser(username, password);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    toggleRecoveryUI('');
                    showNotification(`Login successful! Welcome ${data.user.username} (${data.user.role})`, 'success');
                    window.location.href = 'dashboard.html';
                } else if (data.suspended) {
                    toggleRecoveryUI(data.error || 'This account has been suspended.');
                    showNotification(data.error || 'This account has been suspended.', 'warning');
                } else {
                    toggleRecoveryUI('');
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

        document.getElementById('recoverBtn').addEventListener('click', async () => {
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();

            if (!username || !password) {
                showNotification('Please enter your username and password to recover the account', 'warning');
                return;
            }

            try {
                const response = await fetchWithTimeout('/api/account/recover', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    toggleRecoveryUI('');
                    showNotification(data.message || 'Account recovered successfully.', 'success');
                    window.location.href = 'dashboard.html';
                } else {
                    showNotification(data.error || 'Recovery failed', 'error');
                }
            } catch (error) {
                showNotification('Recovery request failed. Please try again.', 'error');
                console.error(error);
            }
        });
        
        document.getElementById('password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('loginBtn').click();
            }
        });
