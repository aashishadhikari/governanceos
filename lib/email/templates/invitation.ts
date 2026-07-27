export interface InvitationEmailData {
  recipientName: string;
  invitationUrl: string;
  isPasswordReset?: boolean;
}

export function buildInvitationEmail(
  data: InvitationEmailData
) {
  const isReset = data.isPasswordReset ?? false;

  const subject = isReset
    ? 'Reset Your iSend Corporate Entities Governance Platform Account Password'
    : 'You are invited to ISEND Corporate Entities Governance Platform';

  const heading = isReset
    ? 'Reset Your Password'
    : 'Welcome to ISEND Corporate Entities Governance Platform';

  const intro = isReset
    ? 'A password reset has been requested for your iSend Corporate Entities Governance Platform account.'
    : 'An administrator has created your account.';

  const action = isReset
    ? 'Click the button below to create a new password.'
    : 'Click the button below to set your password and activate your account.';

  const buttonText = isReset
    ? 'Reset Password'
    : 'Set Your Password';

  const expiry = isReset
    ? 'This password reset link expires in 24 hours.'
    : 'This invitation expires in 24 hours.';

  const footer = isReset
    ? "If you didn't request this password reset, you can safely ignore this email. Your existing password will remain unchanged until you create a new one."
    : 'If you were not expecting this email, you can safely ignore it.';
  return {
    subject,

    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width:600px; margin:auto;">
        <h2>${heading}</h2>

        <p>Hello ${data.recipientName},</p>

        <p>${intro}</p>

  <p>${action}</p>

        <p style="margin:30px 0;">
          <a
            href="${data.invitationUrl}"
            style="
              background:#4F46E5;
              color:white;
              padding:12px 20px;
              text-decoration:none;
              border-radius:6px;
              display:inline-block;
            "
          >
            ${buttonText}
          </a>
        </p>

        <p>
          If the button above does not work, copy and paste this link into your browser:
        </p>

        <p>
          ${data.invitationUrl}
        </p>

        <hr />

        <p style="font-size:12px;color:#666;">
          ${expiry}
        </p>

        <p style="font-size:12px;color:#666;">
          ${footer}
        </p>

      </div>
    `,
  };
}