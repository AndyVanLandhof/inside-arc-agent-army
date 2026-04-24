import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../lib/db';
import { messages, conversations } from '../../lib/db/schema';
import { eq, and, gt, asc } from 'drizzle-orm';

const CORRECT_PASSWORD = process.env.AGENT_PASSWORD || 'insidearc2026';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId');
  const password = searchParams.get('password');
  const after = searchParams.get('after');

  if (password !== CORRECT_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
  }

  const convId = parseInt(conversationId);

  try {
    const conditions = after
      ? and(eq(messages.conversationId, convId), gt(messages.createdAt, new Date(after)))
      : eq(messages.conversationId, convId);

    const rows = await db
      .select()
      .from(messages)
      .where(conditions)
      .orderBy(asc(messages.createdAt));

    const result = rows.map(row => ({
      id: row.id,
      role: row.role,
      content: row.content,
      userName: row.userName,
      createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
    }));

    return NextResponse.json({ messages: result });
  } catch (error) {
    console.error('Failed to load messages:', error);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { conversationId, password } = await request.json();

    if (password !== CORRECT_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }

    // Delete messages then conversation
    await db.delete(messages).where(eq(messages.conversationId, conversationId));
    await db.delete(conversations).where(eq(conversations.id, conversationId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
}
