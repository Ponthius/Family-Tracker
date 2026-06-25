// Get the form
const inviteForm = document.getElementById("inviteForm");

// Extract invitation token from URL
// Example URL:
// http://localhost:3000/invite/abc123xyz

const token = window.location.pathname.split("/").pop();

inviteForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username =
        document.getElementById("username").value.trim();

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;

    const confirmPassword =
        document.getElementById("confirmPassword").value;

    // Frontend validation
    if (!username || !email || !password || !confirmPassword) {
        alert("All fields are required.");
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match.");
        return;
    }

    try {

        const response = await fetch(
            "/api/invitations/accept",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    token,
                    username,
                    email,
                    password
                })
            }
        );

        const data = await response.json();

        if (response.ok) {

            alert(data.message);

            // Redirect to dashboard
            window.location.href = "/dashboard";

        } else {

            alert(data.message);

        }

    } catch (error) {

        console.error(error);

        alert(
            "Something went wrong. Please try again."
        );

    }
});