const inviteForm = document.getElementById("inviteForm");

inviteForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const role = document.getElementById("role").value;

    try {
        const response = await fetch("/api/invitations", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                role
            })
        });

        const data = await response.json();

        alert(data.message);

    } catch (error) {
        console.error(error);
    }
});