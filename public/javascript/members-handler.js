const membersTableBody = document.getElementById('membersTableBody');
const inviteCard = document.getElementById('inviteCard');
const inviteEmailInput = document.getElementById('inviteEmail');
const inviteFamilyInput = document.getElementById('familyName');
const sendInviteBtn = document.getElementById('sendInviteBtn');
const inviteHint = document.getElementById('inviteHint');
const familyLabel = document.getElementById('familyLabel');

function getStoredUser() {
    try { return JSON.parse(localStorage.getItem('user')) || {}; }
    catch (error) { return {}; }
}

const currentUser = getStoredUser();
const familyId = currentUser.familyId;
const familyName = currentUser.familyName || '';
const isAdmin = currentUser.role === 'admin' || currentUser.role === 'father';
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (familyLabel) {
    familyLabel.textContent = familyName ? `Family: ${familyName}` : 'Family information not available.';
}

if (!isAdmin && inviteCard) {
    inviteCard.classList.add('hidden');
}

if (inviteHint) {
    inviteHint.textContent = isAdmin
        ? 'Invite links expire after 7 days.'
        : 'Only admins can send invites.';
}

if (inviteFamilyInput) {
    inviteFamilyInput.value = familyName || '—';
}

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

function formatRole(role) {
    if (!role) return 'Member';
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

function getRoleClass(role) {
    const safeRole = String(role || 'member').toLowerCase();
    return ['father', 'mother', 'child', 'admin', 'member'].includes(safeRole) ? safeRole : 'member';
}

function renderMembers(members) {
    membersTableBody.innerHTML = '';

    if (!members.length) {
        membersTableBody.innerHTML = `
            <tr>
                <td colspan="3" class="empty-state">No registered users found.</td>
            </tr>
        `;
        return;
    }

    members.forEach((member) => {
        const row = document.createElement('tr');
        const roleCell = document.createElement('td');
        const usernameCell = document.createElement('td');
        const emailCell = document.createElement('td');
        const roleBadge = document.createElement('span');
        const role = formatRole(member.role);
        const roleClass = getRoleClass(member.role);

        roleBadge.className = `role ${roleClass}`;
        roleBadge.textContent = role;
        usernameCell.textContent = member.username || '';
        emailCell.textContent = member.email || '';

        roleCell.appendChild(roleBadge);
        row.appendChild(roleCell);
        row.appendChild(usernameCell);
        row.appendChild(emailCell);
        membersTableBody.appendChild(row);
    });
}

function getSavedMembers() {
    const stored = localStorage.getItem('registeredUsers');
    if (!stored) return [];

    try {
        return JSON.parse(stored);
    } catch (error) {
        return [];
    }
}

async function loadMembers() {
    try {
        const url = familyId ? `/api/members?familyId=${encodeURIComponent(familyId)}` : '/api/members';
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to load members');
        }

        renderMembers(data.members);
    } catch (error) {
        console.error(error);
        renderMembers(getSavedMembers());
    }
}

async function sendInvite() {
    if (!isAdmin) {
        showNotification('Only admins can send invitations.', 'warning');
        return;
    }

    if (!inviteEmailInput || !inviteEmailInput.value.trim()) {
        showNotification('Please enter a recipient email address.', 'warning');
        return;
    }

    if (!emailRegex.test(inviteEmailInput.value.trim())) {
        showNotification('Please enter a valid recipient email address.', 'warning');
        return;
    }

    if (!familyId || !currentUser.id) {
        showNotification('Family details are missing. Please log in again.', 'error');
        return;
    }

    try {
        const response = await fetch('/api/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientEmail: inviteEmailInput.value.trim(),
                familyId,
                invitedById: currentUser.id
            })
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to send invitation');
        }

        inviteEmailInput.value = '';
        showNotification('Invitation sent successfully.', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

if (sendInviteBtn) {
    sendInviteBtn.addEventListener('click', sendInvite);
}

loadMembers();
