export interface InvitationEmailData {
  recipientName: string;
  invitationUrl: string;
}

export function buildInvitationEmail(
  data: InvitationEmailData
) {
  return {
    subject: 'You are invited to ISEND Corporate Entities Governance Platform',

    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width:600px; margin:auto;">
        <h2>Welcome to ISEND Corporate Entities Governance Platform</h2>

        <p>Hello ${data.recipientName},</p>

        <p>
          An administrator has created your account.
        </p>

        <p>
          Click the button below to set your password and activate your account.
        </p>

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
            Set Your Password
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
          This invitation expires in 24 hours.
        </p>

        <p style="font-size:12px;color:#666;">
          If you were not expecting this email, you can safely ignore it.
        </p>

      </div>
    `,
  };
}