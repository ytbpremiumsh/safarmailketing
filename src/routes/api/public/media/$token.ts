import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

export const Route = createFileRoute('/api/public/media/$token')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = z.string().uuid().safeParse(params.token);
        if (!token.success) return new Response('Not found', { status: 404 });
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { data: asset, error } = await supabaseAdmin.from('media_assets')
          .select('storage_path,mime_type').eq('delivery_token', token.data).maybeSingle();
        if (error || !asset) return new Response('Not found', { status: 404 });
        const { data: blob } = await supabaseAdmin.storage.from('media').download(asset.storage_path);
        if (!blob) return new Response('Not found', { status: 404 });
        return new Response(blob, { headers: {
          'Content-Type': asset.mime_type,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "sandbox; default-src 'none'",
          'Content-Disposition': asset.mime_type === 'image/svg+xml' ? 'attachment' : 'inline',
        } });
      },
    },
  },
});