export async function sendLoginLink(env: Env, to: string, url: string) {
  if (env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'QR App <no-reply@yourdomain.com>',
        to, subject: 'Claim your QR code', text: `Click to claim: ${url}`
      })
    });
    if (!r.ok) console.log('Resend error', await r.text());
  } else {
    // Dev fallback: shows link in logs
    console.log(`DEV: send login link to ${to}: ${url}`);
  }
}
