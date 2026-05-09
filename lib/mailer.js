import nodemailer from 'nodemailer';

/**
 * Reusable Nodemailer transport using Gmail SMTP.
 * Requires SMTP_EMAIL and SMTP_PASSWORD in .env.local
 *
 * Setup:
 *  1. Enable 2-Step Verification on Google Account
 *  2. Generate App Password at https://myaccount.google.com/apppasswords
 *  3. Add to .env.local:
 *     SMTP_EMAIL=your-email@gmail.com
 *     SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx
 */
function getTransporter() {
    const email = process.env.SMTP_EMAIL;
    const password = process.env.SMTP_PASSWORD;

    if (!email || !password) {
        console.warn('⚠️  SMTP_EMAIL or SMTP_PASSWORD not configured. Email notifications disabled.');
        return null;
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user: email, pass: password },
    });
}

/* ─────────────── Shared HTML wrapper ─────────────── */
function wrapHtml(title, bodyContent) {
    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
    <body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
            <tr><td align="center">
                <table width="480" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid rgba(249,115,22,0.2);border-radius:24px;overflow:hidden;">
                    <!-- Header -->
                    <tr><td style="background:linear-gradient(135deg,#ff6b35,#ff8c42);padding:32px;text-align:center;">
                        <h1 style="margin:0;color:#fff;font-size:28px;font-weight:900;letter-spacing:-0.5px;">FoundIt</h1>
                        <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">LSPU Lost &amp; Found System</p>
                    </td></tr>
                    <!-- Body -->
                    <tr><td style="padding:36px 32px;">
                        <h2 style="margin:0 0 16px;color:#fff;font-size:22px;font-weight:800;">${title}</h2>
                        ${bodyContent}
                    </td></tr>
                    <!-- Footer -->
                    <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
                        <p style="margin:0;color:rgba(255,255,255,0.2);font-size:11px;">This is an automated message from FoundIt. Do not reply to this email.</p>
                    </td></tr>
                </table>
            </td></tr>
        </table>
    </body>
    </html>`;
}

/**
 * Send verification-approved email.
 */
export async function sendVerificationApproved(email, fullName) {
    const transporter = getTransporter();
    if (!transporter) return { success: false, reason: 'SMTP not configured' };

    const firstName = fullName?.split(' ')[0] || 'Student';
    const html = wrapHtml(
        '✅ Account Verified!',
        `<p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;margin:0 0 20px;">
            Hi <strong style="color:#fff;">${firstName}</strong>,
        </p>
        <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;margin:0 0 20px;">
            Great news! Your student verification has been <strong style="color:#22c55e;">approved</strong>. You now have full access to FoundIt — you can post items, message other users, and help reunite lost belongings with their owners.
        </p>
        <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:16px;padding:20px;margin:20px 0;">
            <p style="margin:0;color:#22c55e;font-size:13px;font-weight:700;">🎉 Your account is now fully active</p>
        </div>
        <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:0;">
            Log in to start using FoundIt today.
        </p>`
    );

    try {
        await transporter.sendMail({
            from: `"FoundIt LSPU" <${process.env.SMTP_EMAIL}>`,
            to: email,
            subject: '✅ Your FoundIt Account Has Been Verified',
            html,
        });
        return { success: true };
    } catch (err) {
        console.error('Email send error (approved):', err);
        return { success: false, reason: err.message };
    }
}

/**
 * Send verification-rejected email.
 */
export async function sendVerificationRejected(email, fullName, reason) {
    const transporter = getTransporter();
    if (!transporter) return { success: false, reason: 'SMTP not configured' };

    const firstName = fullName?.split(' ')[0] || 'Student';
    const reasonBlock = reason
        ? `<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:16px;padding:20px;margin:20px 0;">
            <p style="margin:0 0 6px;color:#ef4444;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Reason</p>
            <p style="margin:0;color:rgba(255,255,255,0.7);font-size:14px;">${reason}</p>
           </div>`
        : '';

    const html = wrapHtml(
        '❌ Verification Not Approved',
        `<p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;margin:0 0 20px;">
            Hi <strong style="color:#fff;">${firstName}</strong>,
        </p>
        <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;margin:0 0 20px;">
            Unfortunately, your student verification was <strong style="color:#ef4444;">not approved</strong>. Please review the reason below and re-upload a valid Certificate of Registration or Student ID.
        </p>
        ${reasonBlock}
        <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:0;">
            You can log back in to re-submit your verification document.
        </p>`
    );

    try {
        await transporter.sendMail({
            from: `"FoundIt LSPU" <${process.env.SMTP_EMAIL}>`,
            to: email,
            subject: '❌ Your FoundIt Verification Was Not Approved',
            html,
        });
        return { success: true };
    } catch (err) {
        console.error('Email send error (rejected):', err);
        return { success: false, reason: err.message };
    }
}

/**
 * Send item-approved email to the poster.
 */
export async function sendItemApproved(email, fullName, itemTitle) {
    const transporter = getTransporter();
    if (!transporter) return { success: false, reason: 'SMTP not configured' };

    const firstName = fullName?.split(' ')[0] || 'Student';
    const html = wrapHtml(
        '✅ Your Post Has Been Approved!',
        `<p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;margin:0 0 20px;">
            Hi <strong style="color:#fff;">${firstName}</strong>,
        </p>
        <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;margin:0 0 20px;">
            Your post <strong style="color:#f97316;">"${itemTitle}"</strong> has been reviewed and <strong style="color:#22c55e;">approved</strong> by an admin. It is now visible to all FoundIt users.
        </p>
        <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:16px;padding:20px;margin:20px 0;">
            <p style="margin:0;color:#22c55e;font-size:13px;font-weight:700;">🎉 Your item is now live and publicly visible</p>
        </div>
        <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:0;">
            Other students can now see your post and reach out to you via the messaging feature.
        </p>`
    );

    try {
        await transporter.sendMail({
            from: `"FoundIt LSPU" <${process.env.SMTP_EMAIL}>`,
            to: email,
            subject: `✅ Your Post "${itemTitle}" Has Been Approved`,
            html,
        });
        return { success: true };
    } catch (err) {
        console.error('Email send error (item approved):', err);
        return { success: false, reason: err.message };
    }
}

/**
 * Send item-rejected email to the poster.
 */
export async function sendItemRejected(email, fullName, itemTitle) {
    const transporter = getTransporter();
    if (!transporter) return { success: false, reason: 'SMTP not configured' };

    const firstName = fullName?.split(' ')[0] || 'Student';
    const html = wrapHtml(
        '❌ Your Post Was Not Approved',
        `<p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;margin:0 0 20px;">
            Hi <strong style="color:#fff;">${firstName}</strong>,
        </p>
        <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;margin:0 0 20px;">
            Unfortunately, your post <strong style="color:#f97316;">"${itemTitle}"</strong> was <strong style="color:#ef4444;">not approved</strong> by an admin and is not visible to other users.
        </p>
        <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:16px;padding:20px;margin:20px 0;">
            <p style="margin:0;color:#ef4444;font-size:13px;font-weight:700;">This post has been rejected and is hidden from other users</p>
        </div>
        <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:0;">
            Please ensure your post follows the community guidelines. You may delete it and submit a new post if needed.
        </p>`
    );

    try {
        await transporter.sendMail({
            from: `"FoundIt LSPU" <${process.env.SMTP_EMAIL}>`,
            to: email,
            subject: `❌ Your Post "${itemTitle}" Was Not Approved`,
            html,
        });
        return { success: true };
    } catch (err) {
        console.error('Email send error (item rejected):', err);
        return { success: false, reason: err.message };
    }
}
