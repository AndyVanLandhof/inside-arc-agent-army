import { NextRequest, NextResponse } from 'next/server';
import { validatePassword, searchMessages } from '@/app/lib/db';
import { agents } from '@/app/lib/agents';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const password = searchParams.get('password');

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!q || q.trim().length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
  }

  const rows = await searchMessages(q.trim());
  const agentMap = Object.fromEntries(agents.map(a => [a.id, a.name]));

  const results = rows.map((r: Record<string, unknown>) => ({
    messageId: r.message_id,
    agentId: r.agent_id,
    agentName: agentMap[r.agent_id as string] || r.agent_id,
    conversationId: r.conversation_id,
    conversationTitle: r.conversation_title || 'Untitled',
    content: (r.content as string).substring(0, 300),
    userName: r.user_name,
    role: r.role,
    createdAt: r.created_at,
  }));

  return NextResponse.json({ results });
}
