import { sendEmail } from './smtp-provider';
import { buildInvitationEmail } from './templates/invitation';

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