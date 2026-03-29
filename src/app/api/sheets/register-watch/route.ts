/**
 * POST /api/sheets/register-watch
 * Registers a Google Drive push-notification watch on the spreadsheet.
 * Call once after deploy; auto-renews via webhook handler when near expiry.
 */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { registerDriveWatch } from '@/lib/sheets';
import { randomUUID } from 'crypto';

const WEBHOOK_SECRET = process.env.SHEETS_WEBHOOK_SECRET || 'svg-sheets-sync';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://acquire.svgstrategies.com';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret');
  if (secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const webhookUrl = `${APP_URL}/api/sheets/webhook`;
  const channelId = randomUUID();

  const result = await registerDriveWatch(webhookUrl, channelId);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    channelId,
    resourceId: result.resourceId,
    webhookUrl,
    expiration: result.expiration ? new Date(parseInt(result.expiration)).toISOString() : null,
  });
}
