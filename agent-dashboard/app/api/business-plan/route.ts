import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import {
  validatePassword,
  getBusinessPlanSections,
  updateBusinessPlanSection,
  getBusinessPlanSnapshots,
  createBusinessPlanSnapshot,
  getBusinessPlanSnapshot,
} from '@/app/lib/db';

// GET — fetch current business plan sections + version history
export async function GET(req: NextRequest) {
  const pw = req.nextUrl.searchParams.get('password');
  if (!pw || !validatePassword(pw)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const snapshotId = req.nextUrl.searchParams.get('snapshotId');
  if (snapshotId) {
    const snapshot = await getBusinessPlanSnapshot(Number(snapshotId));
    return NextResponse.json({ snapshot });
  }

  const sections = await getBusinessPlanSections();
  const snapshots = await getBusinessPlanSnapshots();

  return NextResponse.json({ sections, snapshots });
}

// PATCH — update a specific section
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { sectionKey, content, updatedBy, password } = body;

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!sectionKey || content === undefined) {
    return NextResponse.json({ error: 'sectionKey and content required' }, { status: 400 });
  }

  const section = await updateBusinessPlanSection(sectionKey, content, updatedBy || 'unknown');
  return NextResponse.json({ section });
}

// POST — create a snapshot of the current plan
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { changesSummary, password } = body;

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Build full content from current sections
  const sections = await getBusinessPlanSections();
  const fullContent = sections
    .map((s: Record<string, string>) => `## ${s.title}\n\n${s.content}`)
    .join('\n\n---\n\n');

  const snapshot = await createBusinessPlanSnapshot(fullContent, changesSummary || 'Manual snapshot');
  return NextResponse.json({ snapshot });
}
