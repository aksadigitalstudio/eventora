// A single process owns preview + test lifecycle, also working in isolated Windows execution environments.
if (process.env.TEST_BASE_URL) {
  await import("./workflow.mjs");
} else {
  process.env.PORT = "4202";
  process.env.TEST_BASE_URL = "http://127.0.0.1:4202";
  const { server } = await import("../server.mjs");
  await new Promise((resolve) =>
    server.listening ? resolve() : server.once("listening", resolve),
  );
  try {
    const response = await fetch(process.env.TEST_BASE_URL);
    if (!response.ok) throw Error("Preview health check failed");
    await import("./workflow.mjs");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
