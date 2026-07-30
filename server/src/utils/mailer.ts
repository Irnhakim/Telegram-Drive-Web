import nodemailer from 'nodemailer';

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration missing in server environment variables (.env). Please set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

const getSmtpFrom = () => process.env.SMTP_FROM || 'TeleDrive Recovery <noreply@teledrive.web>';

export async function sendUsernameRecoveryEmail(email: string, username: string): Promise<void> {
  const transport = createTransport();
  await transport.sendMail({
    from: getSmtpFrom(),
    to: email,
    subject: 'TeleDrive Username Recovery',
    text: `Halo,\n\nUsername TeleDrive Anda yang terdaftar pada email ini adalah: ${username}\n\nSilakan kembali ke aplikasi dan login menggunakan username tersebut.\n\nSalam,\nTeleDrive.`,
    html: `<p>Halo,</p><p>Username TeleDrive Anda yang terdaftar pada email ini adalah: <strong>${username}</strong></p><p>Silakan kembali ke aplikasi dan login menggunakan username tersebut.</p><br><p>Salam,</p><p>TeleDrive</p>`,
  });
}

export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  const transport = createTransport();
  await transport.sendMail({
    from: getSmtpFrom(),
    to: email,
    subject: 'TeleDrive Password Reset Request',
    text: `Halo,\n\nAnda menerima email ini karena ada permintaan untuk mereset password akun TeleDrive Anda.\n\nSilakan klik link di bawah ini untuk mereset password Anda:\n${resetLink}\n\nLink ini hanya berlaku selama 1 jam.\n\nJika Anda tidak meminta ini, silakan abaikan email ini.\n\nSalam,\nTeleDrive.`,
    html: `<p>Halo,</p><p>Anda menerima email ini karena ada permintaan untuk mereset password akun TeleDrive Anda.</p><p>Silakan klik tombol atau link di bawah ini untuk mereset password Anda:</p><p><a href="${resetLink}" style="display:inline-block;background:#3b82f6;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold;">Reset Password</a></p><p>Atau buka link berikut di browser Anda:<br><a href="${resetLink}">${resetLink}</a></p><br><p>Link ini hanya berlaku selama 1 jam.</p><p>Jika Anda tidak meminta ini, silakan abaikan email ini.</p><br><p>Salam,</p><p>TeleDrive</p>`,
  });
}
