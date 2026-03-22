import { NextRequest, NextResponse } from 'next/server';
import { validatePassword, findOrCreateConversation, createMessage } from '@/app/lib/db';
import { getAgentById } from '@/app/lib/agents';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sourceAgentId, targetAgentId, content, password } = body;

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!sourceAgentId || !targetAgentId || !content) {
    return NextResponse.json({ error: 'sourceAgentId, targetAgentId, and content required' }, { status: 400 });
  }

  const sourceAgent = getAgentById(sourceAgentId);
  const targetAgent = getAgentById(targetAgentId);

  if (!sourceAgent || !targetAgent) {
    return NextResponse.json({ error: 'Invalid agent ID' }, { status: 400 });
  }

  // Find or create conversation for the target agent
  const conversation = await findOrCreateConversation(targetAgentId, '[Brief]');

  // Create the brief message
  const briefContent = `[Brief from ${sourceAgent.name}]\n\n${content}`;
  const message = await createMessage(conversation.id, 'user', briefContent, `[Brief]`);

  return NextResponse.json({
    success: true,
    message,
    conversationId: conversation.id,
    targetAgentName: targetAgent.name,
  });
}
