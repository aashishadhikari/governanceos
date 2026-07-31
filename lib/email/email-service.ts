import { sendEmail } from './smtp-provider';
import { buildInvitationEmail } from './templates/invitation';
import { buildNotificationEmail, NotificationEmailData } from './templates/notification';

export async function sendInvitationEmail(
  recipientName: string,
  recipientEmail: string,
  invitationUrl: string
): Promise<void> {
  const email = buildInvitationEmail({
    recipientName,
    invitationUrl,
  });

  await sendEmail({
    to: recipientEmail,
    subject: email.subject,
    html: email.html,
  });
}

export async function sendPasswordResetEmail(
  recipientName: string,
  recipientEmail: string,
  invitationUrl: string
): Promise<void> {
  const email = buildInvitationEmail({
    recipientName,
    invitationUrl,
    isPasswordReset: true,
  });

  await sendEmail({
    to: recipientEmail,
    subject: email.subject,
    html: email.html,
  });
}

// Shared by every business-event notification email (meeting invitations,
// filing deadlines, obligation assignment) — one generic sender instead of
// one function per event, same as the two wrappers above share
// buildInvitationEmail.
export async function sendNotificationEmail(
  recipientEmail: string,
  data: NotificationEmailData
): Promise<void> {
  const email = buildNotificationEmail(data);

  await sendEmail({
    to: recipientEmail,
    subject: email.subject,
    html: email.html,
  });
}