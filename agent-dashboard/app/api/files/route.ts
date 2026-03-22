import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { validatePassword, getAllAttachments, deleteAttachment, getContextFiles, createContextFile, deleteContextFile } from '@/app/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const password = searchParams.get('password');

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [attachments, contextFiles] = await Promise.all([
    getAllAttachments(),
    getContextFiles(),
  ]);

  return NextResponse.json({ attachments, contextFiles });
}

export async function PUT(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const password = formData.get('password') as string;
  const description = formData.get('description') as string | null;
  const uploadedBy = formData.get('uploadedBy') as string || 'Unknown';

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!file) {
    return NextResponse.json({ error: 'file required' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    return NextResponse.json({ error: 'File storage not configured. Add BLOB_READ_WRITE_TOKEN to environment.' }, { status: 500 });
  }

  const blob = await put(`agent-army/context/${file.name}`, file, {
    access: 'public',
    token: blobToken,
  });

  const contextFile = await createContextFile(
    file.name,
    blob.url,
    file.type || null,
    file.size,
    uploadedBy,
    description || null,
  );

  return NextResponse.json({ contextFile });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { fileId, fileType, password } = body;

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!fileId) {
    return NextResponse.json({ error: 'fileId required' }, { status: 400 });
  }

  if (fileType === 'context') {
    const deleted = await deleteContextFile(fileId);
    return NextResponse.json({ success: true, deleted: deleted[0] || null });
  } else {
    const deleted = await deleteAttachment(fileId);
    return NextResponse.json({ success: true, deleted: deleted[0] || null });
  }
}
