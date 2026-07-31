// One parameterized builder shared by every business-event notification
// email (meeting invitations, filing deadlines, obligation assignment),
// same convention as buildInvitationEmail — a single template with a data
// object, not one file per event.

export interface NotificationEmailData {
  recipientName: string;
  heading: string;
  message: string;
  actionUrl: string;
  actionText: string;
}

export function buildNotificationEmail(data: NotificationEmailData) {
  return {
    subject: data.heading,
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width:600px; margin:auto;">
        <h2>${data.heading}</h2>

        <p>Hello ${data.recipientName},</p>

        <p>${data.message}</p>

        <p style="margin:30px 0;">
          <a
            href="${data.actionUrl}"
            style="
              background:#4F46E5;
              color:white;
              padding:12px 20px;
              text-decoration:none;
              border-radius:6px;
              display:inline-block;
            "
          >
            ${data.actionText}
          </a>
        </p>

        <p>
          If the button above does not work, copy and paste this link into your browser:
        </p>

        <p>
          ${data.actionUrl}
        </p>
      </div>
    `,
  };
}
