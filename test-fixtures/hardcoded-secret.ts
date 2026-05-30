// test-fixtures/hardcoded-secret.ts
// Expected: 1 Critical (security) — hardcoded API key
// Expected: 1 Warning (style) — any type used

export async function callExternalApi(endpoint: string) {
  // VULNERABILITY: hardcoded API key in source code
  const apiKey = "sk-proj-abc123def456ghi789jkl";

  const response = await fetch(`https://api.example.com/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  return response.json();
}
