// Optional wording polish with Gemini. The facts always come from the database;
// the model only rephrases. If the key is missing or the call fails, the grounded draft is returned unchanged.
export async function polish(draft) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { text: draft, polished: false };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    'Rewrite this customer message to sound warm and professional. Keep every fact, number, order id and policy statement exactly the same. Do not add promises or new facts.\n\n' +
                    draft,
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text ? { text, polished: true } : { text: draft, polished: false };
  } catch {
    return { text: draft, polished: false };
  }
}
