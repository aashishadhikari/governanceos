// Next.js instrumentation hook — runs once when the server starts.
// Validates production configuration so misconfiguration fails loudly at
// boot instead of surfacing as a confusing runtime error later. Never logs
// secret values — only which variable names are missing.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'production') return;

  const missingRequired: string[] = [];
  if (!process.env.NEXTAUTH_SECRET) missingRequired.push('NEXTAUTH_SECRET');
  if (!process.env.DATABASE_URL) missingRequired.push('DATABASE_URL');

  if (missingRequired.length > 0) {
    throw new Error(
      `Missing required production environment variable(s): ${missingRequired.join(', ')}. ` +
      'The application cannot start without these.'
    );
  }

  // Optional integrations degrade gracefully at runtime (e.g. alerts fall
  // back to in-app only without Slack, Jira sync stays disabled without a
  // token) — so these are warnings, not startup failures.
  const smtpVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'];
  const smtpSet = smtpVars.filter((name) => !!process.env[name]);
  if (smtpSet.length > 0 && smtpSet.length < smtpVars.length) {
    console.warn(
      `[startup] Partial SMTP configuration detected (set: ${smtpSet.join(', ')}). ` +
      `Email sending will likely fail — set all of ${smtpVars.join(', ')} or none.`
    );
  }

  const optionalSecrets = ['CRON_SECRET', 'JIRA_WEBHOOK_SECRET', 'CAPITAL_SYNC_API_KEY'];
  const missingOptional = optionalSecrets.filter((name) => !process.env[name]);
  if (missingOptional.length > 0) {
    console.warn(
      `[startup] Not configured: ${missingOptional.join(', ')}. ` +
      'The corresponding machine-to-machine endpoints will reject all external requests ' +
      'until these are set (by design — see proxy.ts and the respective route handlers).'
    );
  }
}
