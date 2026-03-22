import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { validatePassword } from '@/app/lib/db';
import { agents } from '@/app/lib/agents';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, password } = body;

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!message) {
    return NextResponse.json({ error: 'message required' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const agentList = agents.map(a => `- ${a.id}: ${a.name} — ${a.description}`).join('\n');

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 50,
    system: `You are a request router for Inside Arc. Given these agents:\n${agentList}\n\nRoute the user's request to the single best agent. Return ONLY the agent id, nothing else.`,
    messages: [{ role: 'user', content: message }]
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const routedId = textBlock?.text.trim().toLowerCase() || 'product-strategy';

  // Validate the routed agent exists
  const routedAgent = agents.find(a => a.id === routedId) || agents.find(a => a.id === 'product-strategy')!;

  return NextResponse.json({
    agentId: routedAgent.id,
    agentName: routedAgent.name,
  });
}
