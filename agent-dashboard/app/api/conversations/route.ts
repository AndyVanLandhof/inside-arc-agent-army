import { NextRequest, NextResponse } from 'next/server';
import { validatePassword, getConversations, createConversation, updateConversation, deleteConversation } from '@/app/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agentId');
  const password = searchParams.get('password');

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!agentId) {
    return NextResponse.json({ error: 'agentId required' }, { status: 400 });
  }

  const conversations = await getConversations(agentId);
  return NextResponse.json({ conversations });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { agentId, title, createdBy, password } = body;

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!agentId) {
    return NextResponse.json({ error: 'agentId required' }, { status: 400 });
  }

  const conversation = await createConversation(agentId, title || 'New conversation', createdBy || 'Unknown');
  return NextResponse.json({ conversation });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { conversationId, title, archived, password } = body;

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
  }

  const updates: { title?: string; archived?: boolean } = {};
  if (title !== undefined) updates.title = title;
  if (archived !== undefined) updates.archived = archived;

  const result = await updateConversation(conversationId, updates);
  return NextResponse.json({ conversation: result[0] || null });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { conversationId, password } = body;

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
  }

  await deleteConversation(conversationId);
  return NextResponse.json({ success: true });
}
