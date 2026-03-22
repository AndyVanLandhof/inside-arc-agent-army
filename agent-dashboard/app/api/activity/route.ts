import { NextRequest, NextResponse } from 'next/server';
import { validatePassword, getUserActivity, upsertUserActivity } from '@/app/lib/db';

// GET: Fetch all user activity
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const password = searchParams.get('password');

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activity = await getUserActivity();
  return NextResponse.json({ activity });
}

// POST: Record user activity (called on login and chat)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userName, agentId, password } = body;

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!userName) {
    return NextResponse.json({ error: 'userName required' }, { status: 400 });
  }

  await upsertUserActivity(userName, agentId || undefined);
  return NextResponse.json({ success: true });
}
