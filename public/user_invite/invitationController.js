exports.sendInvitation = async (req, res) => {

    try {

        const { email, role } = req.body;

        console.log(email, role);

        res.status(200).json({
            message: "Invitation sent successfully"
        });

    } catch (error) {

        res.status(500).json({
            message: "Error sending invitation"
        });

    }
};

exports.acceptInvitation = async (req, res) => {

    try {

        const {
            token,
            username,
            email,
            password
        } = req.body;

        console.log(
            token,
            username,
            email
        );

        res.status(200).json({
            message: "Account created successfully"
        });

    } catch (error) {

        res.status(500).json({
            message: "Error creating account"
        });

    }
};