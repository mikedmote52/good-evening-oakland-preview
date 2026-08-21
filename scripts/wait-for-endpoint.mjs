const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function waitForEndpoint(url, options = {}) {
  const {
    attempts = 300,
    fetchImpl = fetch,
    intervalMs = 100,
  } = options;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url);
      if (response.ok) return;
    } catch {}
    await pause(intervalMs);
  }

  throw new Error(`Endpoint did not become ready after ${attempts} attempts`);
}
