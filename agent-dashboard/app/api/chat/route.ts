import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { validatePassword, getAgentFacts, getMessages, createMessage, getAttachments, getContextFiles, updateConversation, upsertUserActivity } from '@/app/lib/db';
import { getAgentById, getToolsForAgent } from '@/app/lib/agents';
import { executeToolCall } from '@/app/lib/tools';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { conversationId, agentId, message, userName, password } = body;

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!conversationId || !agentId || !message) {
    return NextResponse.json({ error: 'conversationId, agentId, and message required' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const agent = getAgentById(agentId);
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  // Save user message to DB and track activity
  await createMessage(conversationId, 'user', message, userName);
  if (userName) upsertUserActivity(userName, agentId).catch(() => {});

  // Load agent facts and context files for system prompt injection
  const [facts, contextFiles] = await Promise.all([
    getAgentFacts(agentId),
    getContextFiles(),
  ]);

  // Inject current date so agents always know what day it is
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const userLabel = userName ? `You are speaking with ${userName}. Use their first name naturally — greet them by name at the start of a conversation, and use it occasionally where it feels natural, but not in every single response.\n\n` : '';
  let systemPrompt = `Today's date is ${dateStr}.\n${userLabel}${agent.systemPrompt}`;

  if (facts.length > 0) {
    const factList = facts.map((f) => `- ${f.content}`).join('\n');
    systemPrompt = `KEY FACTS (remembered across all conversations):\n${factList}\n\n${systemPrompt}`;
  }

  if (contextFiles.length > 0) {
    const fileList = contextFiles.map((f) => {
      const desc = f.description ? ` — ${f.description}` : '';
      return `- [ID:${f.id}] ${f.file_name} (${f.file_type || 'unknown type'})${desc}`;
    }).join('\n');
    systemPrompt += `\n\nSHARED CONTEXT FILES (uploaded by the team for all agents):\n${fileList}\nYou can read any of these files using the read_context_file tool with the file ID.`;
  }

  // Load conversation history
  const history = await getMessages(conversationId);
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Load attachments for this conversation and include recent ones
  const attachments = await getAttachments(conversationId);
  const recentAttachments = attachments.filter(
    (a) => {
      const age = Date.now() - new Date(a.created_at as string).getTime();
      return age < 5 * 60 * 1000; // Last 5 minutes
    }
  );

  // If there are recent attachments, add them to the last user message
  if (recentAttachments.length > 0 && messages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'user') {
      const contentBlocks: Anthropic.ContentBlockParam[] = [];

      for (const att of recentAttachments as Record<string, string>[]) {
        try {
          const fileType = att.file_type;
          if (fileType?.startsWith('image/')) {
            // Fetch and convert image to base64
            const response = await fetch(att.file_url);
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            contentBlocks.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: fileType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64,
              },
            });
          } else if (fileType === 'application/pdf') {
            const response = await fetch(att.file_url);
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            contentBlocks.push({
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            } as Anthropic.ContentBlockParam);
          } else {
            // Text files — include as text
            const response = await fetch(att.file_url);
            const text = await response.text();
            contentBlocks.push({
              type: 'text',
              text: `[File: ${att.file_name}]\n${text}`,
            });
          }
        } catch {
          contentBlocks.push({
            type: 'text',
            text: `[Attached file: ${att.file_name} — could not load]`,
          });
        }
      }

      // Add the original text message
      contentBlocks.push({
        type: 'text',
        text: typeof lastMsg.content === 'string' ? lastMsg.content : '',
      });

      messages[messages.length - 1] = {
        role: 'user',
        content: contentBlocks,
      };
    }
  }

  // Get tools for this agent
  const tools = getToolsForAgent(agentId).map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool['input_schema'],
  }));

  const client = new Anthropic({ apiKey });

  // Tool use loop — keep going until we get a final text response
  let response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system: systemPrompt,
    messages,
    tools,
  });

  let loopCount = 0;
  const maxLoops = 5;
  const allTextParts: string[] = [];
  const toolsUsed: string[] = [];
  const consultations: string[] = [];
  const generatedImages: string[] = [];

  // Collect text from the initial response (before any tool use)
  for (const block of response.content) {
    if (block.type === 'text' && block.text.trim()) {
      allTextParts.push(block.text);
    } else if (block.type === 'tool_use') {
      toolsUsed.push(block.name);
    }
  }

  while (response.stop_reason === 'tool_use' && loopCount < maxLoops) {
    loopCount++;

    // Process tool calls
    const assistantContent = response.content;
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of assistantContent) {
      if (block.type === 'tool_use') {
        const result = await executeToolCall(block.name, block.input as Record<string, string>, agentId);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
        // Capture cross-agent consultations for display
        if (block.name === 'ask_agent' && result.startsWith('[Response from')) {
          consultations.push(result);
        }
        // Capture generated images for display
        if (block.name === 'generate_image' && result.includes('![')) {
          generatedImages.push(result);
        }
      }
    }

    // Continue the conversation with tool results
    messages.push({ role: 'assistant', content: assistantContent });
    messages.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools,
    });

    // Collect text and tools from this iteration
    for (const block of response.content) {
      if (block.type === 'text' && block.text.trim()) {
        allTextParts.push(block.text);
      } else if (block.type === 'tool_use') {
        toolsUsed.push(block.name);
      }
    }
  }

  // Combine all text — append cross-agent consultations so they're visible
  let fullText = allTextParts.join('\n\n');
  if (consultations.length > 0) {
    const consultSection = consultations.map(c => {
      // Format as a visible quote block
      const lines = c.split('\n').filter(l => l.trim());
      return lines.map(l => `> ${l}`).join('\n');
    }).join('\n\n');
    fullText += `\n\n---\n\n**Cross-agent consultations:**\n\n${consultSection}`;
  }

  // Append generated images so they appear in the chat
  if (generatedImages.length > 0) {
    fullText += '\n\n' + generatedImages.join('\n\n');
  }

  // Save assistant message to DB
  const savedMessage = await createMessage(conversationId, 'assistant', fullText);

  // Auto-title: if this is the first exchange and title is still default, generate one
  let newTitle: string | null = null;
  const allMessages = await getMessages(conversationId);
  if (allMessages.length <= 2) {
    // Check if conversation still has default title
    try {
      const titleResponse = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 30,
        messages: [{ role: 'user', content: `Generate a very short title (3-6 words, no quotes) for a conversation that starts with: "${message.substring(0, 200)}"` }],
      });
      const titleText = titleResponse.content
        .filter((b) => b.type === 'text')
        .map((b) => b.type === 'text' ? b.text : '')
        .join('')
        .trim()
        .replace(/^["']|["']$/g, '');
      if (titleText && titleText.length > 0 && titleText.length < 80) {
        await updateConversation(conversationId, { title: titleText });
        newTitle = titleText;
      }
    } catch {
      // Non-critical — just skip titling
    }
  }

  return NextResponse.json({
    message: savedMessage,
    toolsUsed: [...new Set(toolsUsed)],
    newTitle,
  });
}
