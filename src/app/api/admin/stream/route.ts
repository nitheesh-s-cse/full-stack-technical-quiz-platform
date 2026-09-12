import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { subscribe, type LiveEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: LiveEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* controller may already be closed */
        }
      };

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "HEARTBEAT", at: new Date().toISOString() })}\n\n`));
      unsubscribe = subscribe(send);
      heartbeat = setInterval(() => {
        send({ type: "HEARTBEAT", at: new Date().toISOString() });
      }, 15_000);
    },
    cancel() {
      unsubscribe();
      clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
