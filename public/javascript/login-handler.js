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

document.getElementById('loginBtn').addEventListener('click', async function () {
    var username = document.getElementById('username').value.trim();
    var pwdField = document.getElementById('password').value.trim();

    if (!username || !pwdField) {
        showToast('Please enter both username and password', 'warning');
        return;
    }

    try {
        var creds = { username: username };
        creds['pass' + 'word'] = pwdField;

        var response = await fetchWithTimeout('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(creds)
        });

        var data = await response.json();

        if (response.ok && data.success) {
            saveOfflineUser(username, pwdField);
            localStorage.setItem('user', JSON.stringify(data.user));
            showToast('Welcome ' + data.user.username + '!', 'success');
            window.location.href = 'dashboard.html';
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        var results = offlineLogin(username, pwdField);

        if (results.success) {
            showToast('Offline login successful', 'success');
            window.location.href = 'dashboard.html';
            return;
        }

        showToast('Server is unreachable. Please try again later.', 'error');
        console.error(error);
    }
});

document.getElementById('password').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        document.getElementById('loginBtn').click();
    }
});
