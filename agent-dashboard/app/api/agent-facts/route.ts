import { NextRequest, NextResponse } from 'next/server';
import { validatePassword, getAgentFacts, createAgentFact, deleteAgentFact } from '@/app/lib/db';

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

  const facts = await getAgentFacts(agentId);
  return NextResponse.json({ facts });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { agentId, content, createdBy, password } = body;

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!agentId || !content) {
    return NextResponse.json({ error: 'agentId and content required' }, { status: 400 });
  }

  const fact = await createAgentFact(agentId, content, createdBy);
  return NextResponse.json({ fact });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { factId, password } = body;

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!factId) {
    return NextResponse.json({ error: 'factId required' }, { status: 400 });
  }

  await deleteAgentFact(factId);
  return NextResponse.json({ success: true });
}
