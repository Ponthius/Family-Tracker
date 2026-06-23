const rescheduleModal =
document.getElementById("rescheduleModal");

const newDate =
document.getElementById("newDate");

const newTime =
document.getElementById("newTime");

const cancelReschedule =
document.getElementById("cancelReschedule");

const saveReschedule =
document.getElementById("saveReschedule");

let selectedTaskId = null;
tr.innerHTML = `
  <td><span class="role-tag">${task.Role || task.role}</span></td>
  <td>${task.Username || task.username}</td>
  <td>${task.TaskName || task.name}</td>
  <td>${(task.Description || task.desc) ? (task.Description || task.desc) : "—"}</td>
  <td>${formatDateTime(task.TaskDate || task.date, task.TaskTime || task.time)}</td>
  <td>
      <button class="reschedule-btn"
          onclick="openRescheduleModal(${task.TaskID || task.id})">
          Reschedule
      </button>
  </td>
`;
function openRescheduleModal(taskId) {

    selectedTaskId = taskId;

    newDate.value = "";
    newTime.value = "";

    rescheduleModal.style.display = "flex";
}

cancelReschedule.addEventListener("click", () => {

    selectedTaskId = null;

    rescheduleModal.style.display = "none";
});

saveReschedule.addEventListener("click", async () => {

    if (!newDate.value || !newTime.value) {

        showNotification("Please select a date and time", "warning");

        return;
    }

    if (isPast(newDate.value, newTime.value)) {

        showNotification("Cannot reschedule to a past date", "warning");

        return;
    }

    try {

        const res = await fetch(
          `http://localhost:4001/tasks/${selectedTaskId}/reschedule`,
          {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                date: newDate.value,
                time: newTime.value
            })
          }
        );

        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.error);
        }

        rescheduleModal.style.display = "none";

        await loadTasks();

        confirmation.textContent =
          "Task rescheduled successfully";

        confirmation.classList.remove("hidden");

        setTimeout(() => {
            confirmation.classList.add("hidden");
        }, 3000);

    } catch (err) {

        showNotification("Failed to reschedule task", "error");

        console.error(err);
    }
});