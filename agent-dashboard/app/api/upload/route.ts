import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { validatePassword, createAttachment } from '@/app/lib/db';

export async function PUT(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const conversationId = formData.get('conversationId') as string;
  const password = formData.get('password') as string;

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!file || !conversationId) {
    return NextResponse.json({ error: 'file and conversationId required' }, { status: 400 });
  }

  // 10MB limit
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    return NextResponse.json({ error: 'File storage not configured. Add BLOB_READ_WRITE_TOKEN to environment.' }, { status: 500 });
  }

  // Upload to Vercel Blob
  const blob = await put(`agent-army/${conversationId}/${file.name}`, file, {
    access: 'public',
    token: blobToken,
  });

  // Save attachment record
  const attachment = await createAttachment(
    parseInt(conversationId),
    file.name,
    blob.url,
    file.type || null,
    file.size,
  );

  return NextResponse.json({ attachment });
}
