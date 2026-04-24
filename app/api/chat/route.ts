import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../lib/db';
import { messages as messagesTable, conversations } from '../../lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { agents } from '../../agents';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Prompt used by Claude when acting as the impartial synthesis judge for The Panel.
// Perspectives are labelled A/B with order randomised so Claude cannot identify its own output.
const PANEL_JUDGE_SYSTEM = `You are an impartial synthesis judge reviewing two anonymous perspectives on a strategic question. You do not know which advisor produced each perspective and must evaluate them purely on the quality of reasoning.

Your response must use exactly this structure:

**Where they agree:**
[Bullet the shared conclusions and common ground]

**Where they differ:**
[For each meaningful divergence: state both positions, then give a clear verdict on which reasoning is stronger and why. Do not hedge — if one argument is better, say so.]

**Synthesis & verdict:**
[A final recommendation that draws on the strongest elements of both perspectives. Acknowledge genuine disagreements rather than papering over them with vague compromise.]`;

const CORRECT_PASSWORD = process.env.AGENT_PASSWORD || 'insidearc2026';

export async function POST(request: NextRequest) {
  try {
    const { message, agentId, conversationId, userName, password } = await request.json();

    // Verify password
    if (password !== CORRECT_PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Look up agent
    const agent = agents.find(a => a.id === agentId);
    if (!agent) {
      return NextResponse.json(
        { error: 'Unknown agent' },
        { status: 400 }
      );
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId required' },
        { status: 400 }
      );
    }

    // Save user message to DB
    await db.insert(messagesTable).values({
      agentId,
      conversationId,
      role: 'user',
      content: message,
      userName: userName || null,
    });

    // Auto-title: if conversation title is still default, update it
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));

    if (conv && conv.title === 'New Conversation') {
      const autoTitle = message.substring(0, 60) + (message.length > 60 ? '...' : '');
      await db
        .update(conversations)
        .set({ title: autoTitle, updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));
    } else {
      // Update the conversation's updatedAt timestamp
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));
    }

    // Load conversation history from DB
    const history = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(asc(messagesTable.createdAt));

    // Use last 50 messages for Claude context (protect against token limits)
    const recentHistory = history.slice(-50);

    const historyMessages = recentHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    let content: string;

    if (agent.id === 'panel') {
      // Fan out to Claude and GPT-4o in parallel
      const [claudeRes, gptRes] = await Promise.all([
        anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: agent.systemPrompt,
          messages: historyMessages,
        }),
        openai.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 2048,
          messages: [
            { role: 'system', content: agent.systemPrompt },
            ...historyMessages,
          ],
        }),
      ]);

      const claudeText = claudeRes.content[0].type === 'text' ? claudeRes.content[0].text : '';
      const gptText = gptRes.choices[0].message.content ?? '';

      // Randomise which perspective is labelled A vs B so Claude cannot identify its own output
      const claudeIsA = Math.random() < 0.5;
      const perspA = claudeIsA ? claudeText : gptText;
      const perspB = claudeIsA ? gptText : claudeText;

      const synthesisRes = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: PANEL_JUDGE_SYSTEM,
        messages: [{
          role: 'user',
          content: `**Perspective A:**\n${perspA}\n\n---\n\n**Perspective B:**\n${perspB}\n\nPlease synthesise these two perspectives.`,
        }],
      });

      const synthesis = synthesisRes.content[0].type === 'text' ? synthesisRes.content[0].text : '';

      content = `**Perspective A:**\n${perspA}\n\n---\n\n**Perspective B:**\n${perspB}\n\n---\n\n${synthesis}`;
    } else {
      // Standard single-model path
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: agent.systemPrompt,
        messages: historyMessages,
      });

      content = response.content[0].type === 'text'
        ? response.content[0].text
        : 'Unable to process response';
    }

    // Save assistant response to DB
    await db.insert(messagesTable).values({
      agentId,
      conversationId,
      role: 'assistant',
      content,
      userName: null,
    });

    return NextResponse.json({ content });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'API request failed' },
      { status: 500 }
    );
  }
}
