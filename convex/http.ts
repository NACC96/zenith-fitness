import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { streamChat } from "./ai";

const http = httpRouter();

http.route({
  path: "/api/chat",
  method: "POST",
  handler: streamChat,
});

http.route({
  path: "/api/chat",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

export default http;
