import { createFileRoute } from '@tanstack/react-router'
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth'

// Pemicu worker antrean email dari penjadwal terkelola. Route ini
// memverifikasi pemanggil cron, lalu meneruskan permintaan ke fungsi
// pengirim email dengan kunci worker dari secret terkelola.
export const Route = createFileRoute('/api/public/jobs/process-queue')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request)
        if (authFailure) return authFailure

        const body = (await request.json().catch(() => ({}))) as {
          background?: boolean
        }
        const queueKey = process.env['QUEUE_WORKER_KEY']
        if (!queueKey) {
          return Response.json(
            { success: false, message: 'Kunci worker belum dikonfigurasi.' },
            { status: 500 },
          )
        }

        const supabaseUrl =
          process.env['SUPABASE_URL'] ?? import.meta.env['VITE_SUPABASE_URL']
        const edgeResponse = await fetch(
          `${supabaseUrl}/functions/v1/mailketing`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-queue-key': queueKey,
            },
            body: JSON.stringify({
              action: 'process-queue',
              background: body.background ?? true,
            }),
          },
        )
        const payload = await edgeResponse.json().catch(() => ({}))
        return Response.json(payload, { status: edgeResponse.status })
      },
    },
  },
})
