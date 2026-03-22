import { NextRequest, NextResponse } from 'next/server';
import { validatePassword, getMessages, createMessage, updateMessagePin, getPinnedMessages } from '@/app/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get('conversationId');
  const pinnedOnly = searchParams.get('pinnedOnly');
  const password = searchParams.get('password');

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
  }

  const id = parseInt(conversationId);
  const messages = pinnedOnly === 'true'
    ? await getPinnedMessages(id)
    : await getMessages(id);

  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { conversationId, role, content, userName, password } = body;

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!conversationId || !role || !content) {
    return NextResponse.json({ error: 'conversationId, role, and content required' }, { status: 400 });
  }

  const message = await createMessage(conversationId, role, content, userName);
  return NextResponse.json({ message });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { messageId, pinned, password } = body;

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!messageId || pinned === undefined) {
    return NextResponse.json({ error: 'messageId and pinned required' }, { status: 400 });
  }

  const message = await updateMessagePin(messageId, pinned);
  return NextResponse.json({ message });
}
