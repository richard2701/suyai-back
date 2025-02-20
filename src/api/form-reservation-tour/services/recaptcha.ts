export async function validateRecaptcha(token: string, userAction: string) {
  const apiKey = process.env.RECAPTCHA_API_KEY;
  const projectId = process.env.RECAPTCHA_PROJECT_ID;
  const siteKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!apiKey || !projectId || !siteKey) {
    return false
  }

  const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: {
          token,
          expectedAction: userAction,
          siteKey
        }
      })
    })

    const data: { riskAnalysis?: { score: number }, tokenProperties?: { valid: boolean } } = await response.json();
    return data.riskAnalysis?.score >= 0.5 && data.tokenProperties?.valid;
  } catch (error) {
    console.error('Error validando reCAPTCHA:', error);
    return false
  }

}