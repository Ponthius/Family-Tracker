       document.getElementById('loginBtn').addEventListener('click', async () => {
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();

            if (!username || !password) {
                alert('Please enter both username and password');
                return;
            }
            
            if (!navigator.online) {
                const results = offlineLogin(username, password);
                if (results.success) {
                    alert('Offline login successful');
                    window.location.href = 'dashbaord.html';
                } else {
                    alert(results.message);
                }
                return;
            }

            try {
                const response = await fetch('http://localhost:3000/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();
                
                if (response.ok && data.success) {
                    saveOfflineUser(username, password);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    alert(`Login successful! Welcome ${data.user.username} (${data.user.role})`);
                    window.location.href = 'dashbaord.html';
                } else {
                    alert(data.error || 'Login failed');
                }
            } catch (error) {
                alert('Error connecting to server. Make sure server is running.');
                console.error(error);
            }
        });
        
        document.getElementById('password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('loginBtn').click();
            }
        });