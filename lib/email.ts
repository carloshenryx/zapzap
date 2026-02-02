type SendEmailInput = {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    from?: string;
};

type SendEmailResult =
    | { status: 'sent'; provider: string }
    | { status: 'skipped'; reason: string }
    | { status: 'error'; provider: string; message: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const to = String(input?.to || '').trim();
    const subject = String(input?.subject || '').trim();

    if (!to || !subject) {
        return { status: 'skipped', reason: 'missing_to_or_subject' };
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const from = String(input.from || process.env.EMAIL_FROM || '').trim();

    if (!resendApiKey || !from) {
        return { status: 'skipped', reason: 'email_not_configured' };
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from,
                to: [to],
                subject,
                text: input.text || undefined,
                html: input.html || undefined,
            }),
        });

        if (!response.ok) {
            const msg = await response.text().catch(() => '');
            return { status: 'error', provider: 'resend', message: msg || `HTTP ${response.status}` };
        }

        return { status: 'sent', provider: 'resend' };
    } catch (err: any) {
        return { status: 'error', provider: 'resend', message: err?.message || 'Failed to send email' };
    }
}

