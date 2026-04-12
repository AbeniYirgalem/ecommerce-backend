import nodemailer from "nodemailer";

const sendEmail = async ({ to, subject, html }) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false, // true for port 465, false for 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    const safeSubject = String(subject || "UniBazzar Notification");
    const safeHtml = String(html || "");

    await transporter.sendMail({
      from: `"UniBazzar" <${process.env.EMAIL_USER}>`,
      to,
      subject: safeSubject,
      html: safeHtml,
    });
    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error(`Nodemailer error: ${error.message}`);
    throw error;
  }
};

export default sendEmail;
