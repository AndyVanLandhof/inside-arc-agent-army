import Anthropic from '@anthropic-ai/sdk';
import { getAgentById } from './agents';
import { searchMessages, createAgentFact, getBusinessPlanSections, updateBusinessPlanSection, createBusinessPlanSnapshot, getContextFiles } from './db';

interface ToolInput {
  [key: string]: string;
}

export async function executeToolCall(
  toolName: string,
  toolInput: ToolInput,
  callingAgentId: string
): Promise<string> {
  switch (toolName) {
    case 'ask_agent':
      return await executeAskAgent(toolInput, callingAgentId);
    case 'save_memory':
      return await executeSaveMemory(toolInput, callingAgentId);
    case 'search_knowledge':
      return await executeSearchKnowledge(toolInput);
    case 'web_search':
      return await executeWebSearch(toolInput);
    case 'calculate':
      return executeCalculate(toolInput);
    case 'read_business_plan':
      return await executeReadBusinessPlan();
    case 'update_business_plan':
      return await executeUpdateBusinessPlan(toolInput, callingAgentId);
    case 'read_context_file':
      return await executeReadContextFile(toolInput);
    case 'generate_image':
      return await executeGenerateImage(toolInput, callingAgentId);
    default:
      return `Unknown tool: ${toolName}`;
  }
}

async function executeAskAgent(input: ToolInput, callingAgentId: string): Promise<string> {
  const targetAgent = getAgentById(input.agent_id);
  if (!targetAgent) return `Agent "${input.agent_id}" not found.`;
  if (input.agent_id === callingAgentId) return 'Cannot ask yourself. Rephrase your question.';

  const callingAgent = getAgentById(callingAgentId);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return 'API key not configured.';

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: `${targetAgent.systemPrompt}\n\nYour colleague ${callingAgent?.name || callingAgentId} is asking you a question. Give a concise, focused answer. Refer to yourself by your name and to them by theirs. Do not use tools.`,
    messages: [{ role: 'user', content: input.question }]
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock ? `[Response from ${targetAgent.name}]\n\n${textBlock.text}` : 'No response received.';
}

async function executeSaveMemory(input: ToolInput, agentId: string): Promise<string> {
  await createAgentFact(agentId, input.fact, 'agent (auto-saved)');
  return `Saved to memory: "${input.fact}"`;
}

async function executeSearchKnowledge(input: ToolInput): Promise<string> {
  const results = await searchMessages(input.query, 10);
  if (results.length === 0) return `No results found for "${input.query}".`;

  const formatted = results.map((r: Record<string, string>) =>
    `[${r.agent_id}] ${r.conversation_title || 'Untitled'}: "${r.content.substring(0, 200)}..." (${r.role})`
  ).join('\n\n');

  return `Found ${results.length} results:\n\n${formatted}`;
}

async function executeWebSearch(input: ToolInput): Promise<string> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) {
    return `Web search is not configured. To enable it, add TAVILY_API_KEY to your environment variables. You can get a key at https://tavily.com.\n\nIn the meantime, please answer based on your training knowledge about: "${input.query}"`;
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: tavilyKey,
      query: input.query,
      max_results: 5,
      include_answer: true,
    })
  });

  if (!response.ok) return `Search failed: ${response.statusText}`;

  const data = await response.json();
  let result = '';
  if (data.answer) result += `Summary: ${data.answer}\n\n`;
  if (data.results) {
    result += 'Sources:\n';
    for (const r of data.results) {
      result += `- ${r.title}: ${r.content?.substring(0, 200)}... (${r.url})\n`;
    }
  }
  return result || 'No results found.';
}

function executeCalculate(input: ToolInput): string {
  try {
    // Safe math evaluation - only allows numbers, operators, parentheses, and common math
    const expr = input.expression;
    const sanitized = expr.replace(/[^0-9+\-*/().,%\s]/g, '');
    if (sanitized !== expr) {
      return `Invalid expression. Only numbers and basic math operators (+, -, *, /, %, parentheses) are allowed.`;
    }
    // Replace % with /100 for percentage calculations
    const processed = sanitized.replace(/(\d+)%/g, '($1/100)');
    const result = Function('"use strict"; return (' + processed + ')')();
    const label = input.label ? `${input.label}: ` : '';
    return `${label}${expr} = ${Number(result).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
  } catch {
    return `Could not evaluate "${input.expression}". Please check the expression.`;
  }
}

async function executeReadBusinessPlan(): Promise<string> {
  const sections = await getBusinessPlanSections();
  if (sections.length === 0) return 'Business plan has not been initialized yet.';

  const formatted = sections.map((s: Record<string, string>) => {
    const updated = s.last_updated ? new Date(s.last_updated).toLocaleDateString('en-GB') : 'unknown';
    return `### ${s.title} [${s.section_key}]\n*Last updated: ${updated} by ${s.updated_by}*\n\n${s.content}`;
  }).join('\n\n---\n\n');

  return `Current Business Plan (${sections.length} sections):\n\n${formatted}`;
}

async function executeUpdateBusinessPlan(input: ToolInput, agentId: string): Promise<string> {
  const { section_key, content, changes_summary } = input;
  if (!section_key || !content) return 'section_key and content are required.';

  const agentName = getAgentById(agentId)?.name || agentId;
  const section = await updateBusinessPlanSection(section_key, content, agentName);
  if (!section) return `Section "${section_key}" not found.`;

  // Create a snapshot after each update
  const allSections = await getBusinessPlanSections();
  const fullContent = allSections
    .map((s: Record<string, string>) => `## ${s.title}\n\n${s.content}`)
    .join('\n\n---\n\n');
  await createBusinessPlanSnapshot(fullContent, changes_summary || `${agentName} updated ${section_key}`);

  return `Updated section "${section.title}". Snapshot saved.`;
}

async function executeGenerateImage(input: ToolInput, callingAgentId: string): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return 'Image generation is not configured. To enable it, add OPENAI_API_KEY to your environment variables (platform.openai.com). In the meantime, please describe the visual in detail as text.';
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const agentName = getAgentById(callingAgentId)?.name || callingAgentId;
  const style = input.style || 'natural';
  const size = input.size || '1024x1024';

  try {
    // Call DALL-E 3
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: input.prompt,
        n: 1,
        size,
        style,
        quality: 'standard',
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = (errData as Record<string, Record<string, string>>)?.error?.message || response.statusText;
      return `Image generation failed: ${errMsg}`;
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;
    const revisedPrompt = data.data?.[0]?.revised_prompt;

    if (!imageUrl) return 'Image generation returned no result.';

    // If we have Blob storage, persist the image
    if (blobToken) {
      try {
        const imgResponse = await fetch(imageUrl);
        const imgBuffer = await imgResponse.arrayBuffer();
        const timestamp = Date.now();
        const fileName = `agent-army/images/${callingAgentId}-${timestamp}.png`;

        const { put } = await import('@vercel/blob');
        const blob = await put(fileName, Buffer.from(imgBuffer), {
          access: 'public',
          token: blobToken,
          contentType: 'image/png',
        });

        return `Image generated by ${agentName}:\n\n![${input.prompt.substring(0, 100)}](${blob.url})\n\n${revisedPrompt ? `*DALL-E interpreted the prompt as: ${revisedPrompt}*` : ''}`;
      } catch {
        // Blob upload failed, fall back to temporary URL
      }
    }

    // Return the temporary OpenAI URL (expires after ~1 hour)
    return `Image generated by ${agentName} (temporary link — expires in ~1 hour):\n\n![${input.prompt.substring(0, 100)}](${imageUrl})\n\n${revisedPrompt ? `*DALL-E interpreted the prompt as: ${revisedPrompt}*` : ''}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return `Image generation failed: ${msg}`;
  }
}

async function executeReadContextFile(input: ToolInput): Promise<string> {
  const fileId = parseInt(input.file_id);
  if (isNaN(fileId)) return 'Invalid file_id. Provide the numeric ID from the SHARED CONTEXT FILES list.';

  const files = await getContextFiles();
  const file = files.find((f) => f.id === fileId);
  if (!file) return `Context file with ID ${fileId} not found.`;

  try {
    const fileType = file.file_type as string || '';
    const url = file.file_url as string;
    const name = file.file_name as string;

    if (fileType.startsWith('image/')) {
      return `[${name}] This is an image file. Image content cannot be read as text — it would need to be attached to a conversation for visual analysis.`;
    }

    if (fileType === 'application/pdf') {
      // For PDFs, return a note that they need to be attached to a conversation
      return `[${name}] This is a PDF file. PDF content is best analysed when attached directly to a conversation via the paperclip icon. The file is available at: ${url}`;
    }

    // Text-based files — fetch and return content
    const response = await fetch(url);
    const text = await response.text();
    const truncated = text.length > 10000 ? text.substring(0, 10000) + '\n\n[...truncated — file is ' + text.length + ' characters]' : text;
    return `[File: ${name}]\n\n${truncated}`;
  } catch {
    return `Could not read file "${file.file_name}". It may be temporarily unavailable.`;
  }
}
