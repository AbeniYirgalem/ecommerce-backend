import Contact from "../models/Contact.model.js";
import sendEmail from "../utils/sendEmail.js";

const CONTACT_RECEIVER_EMAIL = "abenezeryirgalem0@gmail.com";

const buildContactEmailHtml = ({ name, email, message }) => {
  return `
    <h3>New Contact Message from UniBazzar</h3>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Message:</strong></p>
    <p>${message.replace(/\n/g, "<br/>")}</p>
  `;
};

export const sendContactMessage = async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const message = String(req.body?.message || "").trim();

    const contactMessage = await Contact.create({
      name,
      email,
      message,
    });

    await sendEmail({
      to: CONTACT_RECEIVER_EMAIL,
      subject: `New Contact Message from ${name}`,
      html: buildContactEmailHtml({ name, email, message }),
    });

    return res.status(201).json({
      success: true,
      message: "Message sent successfully!",
      id: contactMessage._id,
    });
  } catch (error) {
    return next(error);
  }
};
