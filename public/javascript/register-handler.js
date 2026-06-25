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

const inviteNote = document.getElementById('inviteNote');
const familyNameInput = document.getElementById('familyName');
const registerBtn = document.getElementById('registerBtn');
const inviteToken = new URLSearchParams(window.location.search).get('invite');
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function showNotification(message, type) {
    const container = document.getElementById('notification-container');
    const msgSpan = document.getElementById('notification-message');
    container.className = `notif-${type || 'info'}`;
    msgSpan.textContent = message;
    container.style.opacity = '1';
    container.style.pointerEvents = 'auto';
    setTimeout(() => {
        container.style.opacity = '0';
        container.style.pointerEvents = 'none';
    }, 3000);
}

async function loadInviteDetails() {
    if (!inviteToken) return;
    if (inviteNote) inviteNote.textContent = 'Loading invitation details...';

    try {
        const response = await fetchWithTimeout(`/api/invites/${inviteToken}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Invitation not found');
        }

        if (familyNameInput) {
            familyNameInput.value = data.invitation.familyName || '';
            familyNameInput.readOnly = true;
        }

        if (inviteNote) {
            inviteNote.textContent = `Joining the ${data.invitation.familyName} family.`;
            inviteNote.classList.remove('error');
        }
    } catch (error) {
        if (inviteNote) {
            inviteNote.textContent = 'Invitation link is invalid or expired.';
            inviteNote.classList.add('error');
        }
        if (registerBtn) registerBtn.disabled = true;
    }
}

loadInviteDetails();

document.getElementById('registerBtn').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const confirm = document.getElementById('confirm').value.trim();
    const familyName = familyNameInput ? familyNameInput.value.trim() : '';

    if (!email || !username || !password || !confirm || (!inviteToken && !familyName)) {
        showNotification("Please fill in all fields", "warning");
        return;
    }
    
    if (!emailRegex.test(email)) {
        showNotification("Please enter a valid email address", "warning");
        return;
    }
    
    if (username.length < 3) {
        showNotification("Username must be at least 3 characters", "warning");
        return;
    }
    
    if (password.length < 4) {
        showNotification('Password must be at least 4 characters', 'warning');
        return;
    }
    
    if (password !== confirm) {
        showNotification("Passwords do not match", "error");
        return;
    }

    try {
        const response = await fetchWithTimeout('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username, password, familyName, inviteToken })
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
            const assignedRole = inviteToken ? 'member' : 'admin';
            saveRegisteredUser({
                 email, 
                 username,
                 role: assignedRole,
                 familyName
              });

            showNotification(
                "Registration successful! Please check your email and verify your account before logging in.",
                "success"
            );
            
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);
        } else {
            showNotification(
                data.error || 'Registration failed', 
                'error'
            );
        }
    } catch (error) {
        showNotification('Online registration is unavailable. Start the server, then try again', 'warning');
        console.error('Error during registration request:', error);
    }
});
