const membersTableBody = document.getElementById('membersTableBody');

function formatRole(role) {
    if (!role) return 'Member';
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

function getRoleClass(role) {
    const safeRole = String(role || 'member').toLowerCase();
    return ['father', 'mother', 'child'].includes(safeRole) ? safeRole : 'member';
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
        const response = await fetch('http://localhost:3000/members');
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

loadMembers();
