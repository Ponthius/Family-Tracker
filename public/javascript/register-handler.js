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

            if (!navigator.online) {
                alert('No internet connection. Please connect to the internet for successful registration.');
                return;
            }

            try {
                const response = await fetch('http://localhost:3000/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, username, password, role })
                });

                const data = await response.json();
                
                if (response.ok && data.success) {
                    saveOfflineUser(username, password);
                    alert('Registration successful! Please login.');
                    window.location.href = 'login.html';
                } else {
                    alert(data.error || 'Registration failed');
                }
            } catch (error) {
                alert('Error connecting to server.');
                console.error(error);
            }
        });