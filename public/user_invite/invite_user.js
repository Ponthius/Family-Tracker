const API = '/api';

function getStoredUser() {
    try { return JSON.parse(localStorage.getItem('user')) || {}; }
    catch (e) { return {}; }
}

document.getElementById('inviteForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const role = document.getElementById('role').value;
    const user = getStoredUser();
    const msgDiv = document.getElementById('message');

    if (!email || !role) {
        msgDiv.textContent = 'Please fill in all fields.';
        msgDiv.style.color = '#a13d3d';
        return;
    }

    if (!user.family_id) {
        msgDiv.textContent = 'You must be part of a family to send invitations.';
        msgDiv.style.color = '#a13d3d';
        return;
    }

    try {
        const res = await fetch(API + '/invitations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, role, familyId: user.family_id })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            msgDiv.textContent = 'Invitation created successfully. Share this link:\n' + window.location.origin + '/user_invite/invite_setup.html?token=' + data.token;
            msgDiv.style.color = '#3c5a3c';
            document.getElementById('email').value = '';
            document.getElementById('role').value = '';
        } else {
            msgDiv.textContent = data.error || 'Failed to send invitation.';
            msgDiv.style.color = '#a13d3d';
        }
    } catch (err) {
        msgDiv.textContent = 'Server error. Please try again.';
        msgDiv.style.color = '#a13d3d';
        console.error(err);
    }
});
