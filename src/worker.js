import { handleApi } from "./server/router.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isApi = url.pathname === "/api" || url.pathname.startsWith("/api/");
    if (!isApi) return env.ASSETS.fetch(request);

    const started = Date.now();
    const response = await handleApi(request, env);
    console.log(
      JSON.stringify({
        level: "info",
        method: request.method,
        path: url.pathname,
        status: response.status,
        ms: Date.now() - started,
      }),
    );
    return response;
  },
};
