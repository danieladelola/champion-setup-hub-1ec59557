import { createFileRoute } from "@tanstack/react-router";

import { getAdminFromRequest, json } from "@/lib/auth.server";
import { getDb } from "@/lib/db.server";
import { BOOKING_STATUSES } from "@/lib/services.server";

const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"] as const;

export const Route = createFileRoute("/api/admin/bookings/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const admin = await getAdminFromRequest(request).catch(() => null);
        if (!admin) return json({ error: "Unauthorized" }, { status: 401 });
        let body: { status?: string; payment_status?: string };
        try {
          body = (await request.json()) as { status?: string; payment_status?: string };
        } catch {
          return json({ error: "Invalid request" }, { status: 400 });
        }

        const { status, payment_status: paymentStatus } = body;
        if (status && !(BOOKING_STATUSES as readonly string[]).includes(status)) {
          return json({ error: "Invalid status" }, { status: 400 });
        }
        if (paymentStatus && !(PAYMENT_STATUSES as readonly string[]).includes(paymentStatus)) {
          return json({ error: "Invalid payment status" }, { status: 400 });
        }
        if (!status && !paymentStatus) {
          return json({ error: "Nothing to update" }, { status: 400 });
        }

        const sql = getDb();
        // Booking status and payment status are independent; only touch what was sent.
        const rows = await sql`
          update bookings set
            status = coalesce(${status ?? null}, status),
            payment_status = coalesce(${paymentStatus ?? null}, payment_status),
            paid_at = case
              when ${paymentStatus ?? null} = 'paid' then coalesce(paid_at, now())
              when ${paymentStatus ?? null} in ('unpaid', 'refunded') then null
              else paid_at end,
            updated_at = now()
          where id = ${params.id}
          returning *`;
        if (!rows[0]) return json({ error: "Not found" }, { status: 404 });
        return json({ booking: rows[0] });
      },
      DELETE: async ({ request, params }) => {
        const admin = await getAdminFromRequest(request).catch(() => null);
        if (!admin) return json({ error: "Unauthorized" }, { status: 401 });
        const sql = getDb();
        await sql`delete from bookings where id = ${params.id}`;
        return json({ ok: true });
      },
    },
  },
});
