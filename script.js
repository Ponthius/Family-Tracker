// Sample data - eventually this could come from an API
const events = [
    { role: "Father", username: "John", event: "Work Meeting", time: "09:00", date: "2026-06-17", status: "Occupied" },
    { role: "Mother", username: "Sarah", event: "Grocery Shopping", time: "11:00", date: "2026-06-17", status: "Unoccupied" },
    { role: "Son", username: "Alex", event: "Football Practice", time: "16:00", date: "2026-06-16", status: "Occupied" }
];

function loadSchedule() {
    const tableBody = document.getElementById('scheduleBody');
    const noEventsMsg = document.getElementById('noEventsMessage');

    // Requirement #11: Handling empty state
    if (!events || events.length === 0) {
        document.getElementById('scheduleTable').style.display = 'none';
        noEventsMsg.style.display = 'block';
        return;
    }

    // Requirement #10: Sorting events in chronological order
    // Combines date and time into a comparable format
    events.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

    // Clear previous content
    tableBody.innerHTML = '';

    // Render the table rows
    events.forEach(item => {
        const row = `<tr>
            <td>${item.role}</td>
            <td>${item.username}</td>
            <td>${item.event}</td>
            <td>${item.time}</td>
            <td>${item.date}</td>
            <td class="${item.status === 'Occupied' ? 'status-occupied' : 'status-unoccupied'}">
                ${item.status}
            </td>
        </tr>`;
        tableBody.innerHTML += row;
    });
}

// Run the function when the page loads
window.onload = loadSchedule;
