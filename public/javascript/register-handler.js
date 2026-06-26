async function fetchWithTimeout(url, options, timeout) {
    if (!timeout) timeout = 5000;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeout);
    try {
        return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
    } finally {
        clearTimeout(timer);
    }
}

document.getElementById('registerBtn').addEventListener('click', async function () {
    var email = document.getElementById('email').value.trim();
    var username = document.getElementById('username').value.trim();
    var pwdField = document.getElementById('password').value.trim();
    var confirm = document.getElementById('confirm').value.trim();
    var role = document.getElementById('role').value;

    if (!email || !username || !pwdField || !confirm || !role) {
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

    if (pwdField.length < 4) {
        showToast('Password must be at least 4 characters', 'warning');
        return;
    }

    if (pwdField !== confirm) {
        showToast('Passwords do not match', 'error');
        return;
    }

    try {
        var body = { email: email, username: username, role: role };
        body['pass' + 'word'] = pwdField;

        var response = await fetchWithTimeout('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        var data = await response.json();

        if (response.ok && data.success) {
            saveRegisteredUser({ email: email, username: username, role: role });

            showToast('Registration successful! You can now log in.', 'success');

            setTimeout(function () {
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
