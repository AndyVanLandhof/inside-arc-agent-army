import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { validatePassword, getAgentView, upsertAgentView, getAllMessagesForAgent, getAgentFacts } from '@/app/lib/db';
import { getAgentById } from '@/app/lib/agents';

export const maxDuration = 300;

// GET: Fetch existing view for an agent
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

  const view = await getAgentView(agentId);
  return NextResponse.json({ view });
}

// POST: Generate (or regenerate) the latest view
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { agentId, userName, password } = body;

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!agentId) {
    return NextResponse.json({ error: 'agentId required' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const agent = getAgentById(agentId);
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  // Load all messages for this agent
  const messages = await getAllMessagesForAgent(agentId);
  if (messages.length === 0) {
    return NextResponse.json({ error: 'No conversations yet for this agent' }, { status: 400 });
  }

  // Load agent facts too
  const facts = await getAgentFacts(agentId);

  // Build the conversation transcript
  const transcript = messages.map((m) => {
    const speaker = m.role === 'user' ? (m.user_name || 'User') : agent.name;
    return `[${speaker}]: ${m.content}`;
  }).join('\n\n');

  const factsSection = facts.length > 0
    ? `\n\nAGENT MEMORY (key facts stored):\n${facts.map((f) => `- ${f.content}`).join('\n')}`
    : '';

  const synthesisPrompt = `You are synthesising all conversations with ${agent.name} (${agent.description}) into a "Latest View" — a concise, authoritative summary of the current state of play for this agent's domain.

RULES:
- Output ONLY bullet points grouped under clear headings
- Each bullet should be a crisp, specific statement of the current position (not a summary of what was discussed)
- If an earlier conversation said one thing and a later conversation changed it, ONLY include the latest position
- Include specific numbers, dates, names, and decisions where they exist
- This should read like a briefing document — someone reading it should know exactly where things stand
- Do NOT include preamble, conclusions, or meta-commentary
- Use markdown: ## for headings, - for bullets, **bold** for key terms
- Keep it dense: aim for 15-40 bullets total depending on how much ground has been covered

${factsSection}

FULL CONVERSATION HISTORY:
${transcript}`;

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    messages: [{ role: 'user', content: synthesisPrompt }],
  });

  const content = response.content
    .filter((b) => b.type === 'text')
    .map((b) => {
      if (b.type === 'text') return b.text;
      return '';
    })
    .join('\n');

  // Save to DB
  const view = await upsertAgentView(agentId, content, userName || 'system');

  return NextResponse.json({ view });
}
