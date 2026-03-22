import { NextRequest, NextResponse } from 'next/server';
import { validatePassword, initializeSchema } from '@/app/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { password } = body;

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await initializeSchema();
    return NextResponse.json({ success: true, message: 'Schema initialized successfully' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
