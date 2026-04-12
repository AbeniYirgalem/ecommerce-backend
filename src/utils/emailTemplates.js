export const verificationEmailTemplate = ({ name, verificationUrl }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Your UniBazzar Account</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6fb;font-family:Arial,sans-serif;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:#1d4ed8;padding:24px 28px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.2;">UniBazzar</h1>
              <p style="margin:8px 0 0;color:#dbeafe;font-size:14px;">University Marketplace</p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">Hello ${name},</p>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#4b5563;">
                Thank you for registering with UniBazzar. Please verify your email address to activate your account.
              </p>

              <div style="text-align:center;margin:24px 0;">
                <a href="${verificationUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;">
                  Verify Email
                </a>
              </div>

              <p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:#6b7280;">
                This link expires in 1 hour. If you did not create this account, you can ignore this email.
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;word-break:break-all;">
                Verification URL: ${verificationUrl}
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 28px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">(c) 2026 UniBazzar. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

export const resetPasswordEmailTemplate = ({ name, resetUrl }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your UniBazzar Password</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6fb;font-family:Arial,sans-serif;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:#b91c1c;padding:24px 28px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.2;">UniBazzar</h1>
              <p style="margin:8px 0 0;color:#fecaca;font-size:14px;">Password Reset</p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">Hello ${name},</p>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#4b5563;">
                We received a request to reset your UniBazzar password. Click the button below to continue.
              </p>

              <div style="text-align:center;margin:24px 0;">
                <a href="${resetUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;">
                  Reset Password
                </a>
              </div>

              <p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:#6b7280;">
                This link expires in 1 hour. If you did not request this, you can ignore this email.
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;word-break:break-all;">
                Reset URL: ${resetUrl}
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 28px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">(c) 2026 UniBazzar. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
