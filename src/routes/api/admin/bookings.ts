import { createFileRoute } from "@tanstack/react-router";

import { getAdminFromRequest, json } from "@/lib/auth.server";
import { getDb } from "@/lib/db.server";

export const Route = createFileRoute("/api/admin/bookings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const admin = await getAdminFromRequest(request);
          if (!admin) return json({ error: "Unauthorized" }, { status: 401 });
          const sql = getDb();
          const bookings = await sql`
            select id, booking_reference, full_name, email, phone, service, category_name,
                   price, currency, duration_minutes, preferred_date, preferred_time, notes,
                   status, coalesce(payment_status, 'unpaid') as payment_status,
                   payment_method, payment_provider, paid_at, created_at
            from bookings
            order by created_at desc
            limit 500`;

          const statsRows = await sql`
            select
              count(*)::int as total,
              count(*) filter (where coalesce(payment_status,'unpaid') = 'paid')::int as paid,
              count(*) filter (where coalesce(payment_status,'unpaid') <> 'paid'
                               and status <> 'cancelled')::int as pending_payment,
              count(*) filter (where status = 'completed')::int as completed,
              count(*) filter (where status = 'cancelled')::int as cancelled,
              coalesce(sum(price) filter (where coalesce(payment_status,'unpaid') = 'paid'), 0) as revenue
            from bookings`;

          return json({ bookings, stats: statsRows[0] });
        } catch (error) {
          console.error("GET /api/admin/bookings failed", error);
          return json({ error: "Database unavailable" }, { status: 503 });
        }
      },
    },
  },
});
