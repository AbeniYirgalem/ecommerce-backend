import express from "express";
import sendEmail from "../utils/sendEmail.js";

const router = express.Router();
const CONTACT_RECEIVER_EMAIL = "abenezeryirgalem0@gmail.com";

router.post("/", async (req, res) => {
  try {
    const { name, email, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Please fill all fields.",
      });
    }

    await sendEmail({
      to: CONTACT_RECEIVER_EMAIL,
      subject: `New Contact Message from ${name}`,
      html: `
        <h3>New Message from UniBazzar</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
    });

    return res.json({ success: true, message: "Message sent successfully!" });
  } catch (error) {
    console.error("[contact] error sending email", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send message. Please try again.",
    });
  }
});

export default router;
