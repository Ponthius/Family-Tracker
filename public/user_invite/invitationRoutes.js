const express = require("express");
const router = express.Router();

const invitationController =
require("../controllers/invitationController");

// Send invitation
router.post(
    "/",
    invitationController.sendInvitation
);

// Accept invitation
router.post(
    "/accept",
    invitationController.acceptInvitation
);

module.exports = router;