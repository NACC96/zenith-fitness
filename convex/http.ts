import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { streamChat } from "./ai";
import { getCorsHeaders, isAllowedOrigin, parseAllowedOrigins } from "./lib/httpSecurity";

const http = httpRouter();

http.route({
  path: "/api/chat",
  method: "POST",
  handler: streamChat,
});

http.route({
  path: "/api/chat",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    const origin = request.headers.get("Origin");
    const allowedOrigins = parseAllowedOrigins(process.env.ZENITH_ALLOWED_ORIGINS);
    const allowLocalOrigins = process.env.ZENITH_ALLOW_LOCAL_ORIGINS === "true";
    if (!isAllowedOrigin(origin, allowedOrigins, allowLocalOrigins)) {
      return new Response(null, {
        status: 403,
        headers: getCorsHeaders(origin, allowedOrigins, allowLocalOrigins),
      });
    }

    return new Response(null, {
      headers: getCorsHeaders(origin, allowedOrigins, allowLocalOrigins),
    });
  }),
});

export default http;
