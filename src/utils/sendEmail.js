import SibApiV3Sdk from "sib-api-v3-sdk";

const VERIFIED_SENDER_EMAIL = "abenezeryirgalem0@gmail.com";
const VERIFIED_SENDER_NAME = "UniBazzar";

const normalizeRecipients = (to) => {
  if (Array.isArray(to)) {
    return to
      .map((email) => String(email || "").trim())
      .filter(Boolean)
      .map((email) => ({ email }));
  }

  const single = String(to || "").trim();
  return single ? [{ email: single }] : [];
};

const sendEmail = async ({ to, subject, html }) => {
  const apiKey = String(process.env.BREVO_API_KEY || "").trim();

  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured");
  }

  const recipients = normalizeRecipients(to);
  if (recipients.length === 0) {
    throw new Error("At least one valid recipient is required");
  }

  const defaultClient = SibApiV3Sdk.ApiClient.instance;
  defaultClient.authentications["api-key"].apiKey = apiKey;

  const transactionalApi = new SibApiV3Sdk.TransactionalEmailsApi();

  const payload = new SibApiV3Sdk.SendSmtpEmail();
  payload.sender = {
    email: VERIFIED_SENDER_EMAIL,
    name: VERIFIED_SENDER_NAME,
  };
  payload.to = recipients;
  payload.subject = String(subject || "UniBazzar Notification");
  payload.htmlContent = String(html || "");

  try {
    await transactionalApi.sendTransacEmail(payload);
    console.log(
      `Brevo email sent successfully to ${recipients.map((r) => r.email).join(", ")}`,
    );
  } catch (error) {
    const details =
      error?.response?.body?.message || error?.message || "Unknown Brevo error";
    console.error(`Brevo send error: ${details}`);
    throw error;
  }
};

export default sendEmail;
