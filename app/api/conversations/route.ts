import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../lib/db';
import { conversations } from '../../lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

const CORRECT_PASSWORD = process.env.AGENT_PASSWORD || 'insidearc2026';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');
  const password = searchParams.get('password');

  if (password !== CORRECT_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!agentId) {
    return NextResponse.json({ error: 'agentId required' }, { status: 400 });
  }

  try {
    const rows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.agentId, agentId))
      .orderBy(desc(conversations.updatedAt));

    const result = rows.map(row => ({
      id: row.id,
      agentId: row.agentId,
      title: row.title,
      status: row.status,
      createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() || new Date().toISOString(),
    }));

    return NextResponse.json({ conversations: result });
  } catch (error) {
    console.error('Failed to load conversations:', error);
    return NextResponse.json({ error: 'Failed to load conversations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { agentId, password } = await request.json();

    if (password !== CORRECT_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!agentId) {
      return NextResponse.json({ error: 'agentId required' }, { status: 400 });
    }

    // Archive any currently active conversations for this agent
    await db
      .update(conversations)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(and(eq(conversations.agentId, agentId), eq(conversations.status, 'active')));

    // Create new active conversation
    const [newConv] = await db
      .insert(conversations)
      .values({ agentId, title: 'New Conversation', status: 'active' })
      .returning();

    return NextResponse.json({
      conversation: {
        id: newConv.id,
        agentId: newConv.agentId,
        title: newConv.title,
        status: newConv.status,
        createdAt: newConv.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: newConv.updatedAt?.toISOString() || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to create conversation:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { conversationId, title, status, password } = await request.json();

    if (password !== CORRECT_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (status !== undefined) updates.status = status;

    await db
      .update(conversations)
      .set(updates)
      .where(eq(conversations.id, conversationId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update conversation:', error);
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}
