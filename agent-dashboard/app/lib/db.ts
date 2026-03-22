import { neon } from '@neondatabase/serverless';

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return neon(url);
}

export function validatePassword(password: string): boolean {
  return password === process.env.DASHBOARD_PASSWORD;
}

// ── Conversations ──

export async function getConversations(agentId: string) {
  const sql = getDb();
  return sql`
    SELECT * FROM conversations
    WHERE agent_id = ${agentId}
    ORDER BY created_at DESC
  `;
}

export async function createConversation(agentId: string, title: string, createdBy: string) {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO conversations (agent_id, title, created_by)
    VALUES (${agentId}, ${title}, ${createdBy})
    RETURNING *
  `;
  return rows[0];
}

export async function updateConversation(id: number, updates: { title?: string; archived?: boolean }) {
  const sql = getDb();
  if (updates.title !== undefined && updates.archived !== undefined) {
    return sql`UPDATE conversations SET title = ${updates.title}, archived = ${updates.archived} WHERE id = ${id} RETURNING *`;
  } else if (updates.title !== undefined) {
    return sql`UPDATE conversations SET title = ${updates.title} WHERE id = ${id} RETURNING *`;
  } else if (updates.archived !== undefined) {
    return sql`UPDATE conversations SET archived = ${updates.archived} WHERE id = ${id} RETURNING *`;
  }
  return [];
}

export async function deleteConversation(id: number) {
  const sql = getDb();
  return sql`DELETE FROM conversations WHERE id = ${id}`;
}

// ── Messages ──

export async function getMessages(conversationId: number) {
  const sql = getDb();
  return sql`
    SELECT * FROM messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC
  `;
}

export async function createMessage(conversationId: number, role: string, content: string, userName?: string) {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO messages (conversation_id, role, content, user_name)
    VALUES (${conversationId}, ${role}, ${content}, ${userName || null})
    RETURNING *
  `;
  return rows[0];
}

export async function updateMessagePin(messageId: number, pinned: boolean) {
  const sql = getDb();
  const rows = await sql`
    UPDATE messages SET pinned = ${pinned} WHERE id = ${messageId} RETURNING *
  `;
  return rows[0];
}

export async function getPinnedMessages(conversationId: number) {
  const sql = getDb();
  return sql`
    SELECT * FROM messages
    WHERE conversation_id = ${conversationId} AND pinned = true
    ORDER BY created_at ASC
  `;
}

// ── Agent Facts ──

export async function getAgentFacts(agentId: string) {
  const sql = getDb();
  return sql`
    SELECT * FROM agent_facts
    WHERE agent_id = ${agentId}
    ORDER BY created_at DESC
  `;
}

export async function createAgentFact(agentId: string, content: string, createdBy?: string) {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO agent_facts (agent_id, content, created_by)
    VALUES (${agentId}, ${content}, ${createdBy || null})
    RETURNING *
  `;
  return rows[0];
}

export async function deleteAgentFact(factId: number) {
  const sql = getDb();
  return sql`DELETE FROM agent_facts WHERE id = ${factId}`;
}

// ── Search ──

export async function searchMessages(query: string, limit = 50) {
  const sql = getDb();
  const pattern = `%${query}%`;
  return sql`
    SELECT
      m.id as message_id,
      m.content,
      m.role,
      m.user_name,
      m.created_at,
      c.id as conversation_id,
      c.agent_id,
      c.title as conversation_title
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE m.content ILIKE ${pattern}
    ORDER BY m.created_at DESC
    LIMIT ${limit}
  `;
}

// ── Attachments ──

export async function getAllAttachments() {
  const sql = getDb();
  return sql`
    SELECT a.*, c.agent_id, c.title as conversation_title
    FROM attachments a
    JOIN conversations c ON a.conversation_id = c.id
    ORDER BY a.created_at DESC
  `;
}

export async function deleteAttachment(id: number) {
  const sql = getDb();
  return sql`DELETE FROM attachments WHERE id = ${id} RETURNING *`;
}

export async function getAttachments(conversationId: number) {
  const sql = getDb();
  return sql`
    SELECT * FROM attachments
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC
  `;
}

export async function getMessageAttachments(messageId: number) {
  const sql = getDb();
  return sql`
    SELECT * FROM attachments
    WHERE message_id = ${messageId}
    ORDER BY created_at ASC
  `;
}

export async function createAttachment(
  conversationId: number,
  fileName: string,
  fileUrl: string,
  fileType: string | null,
  fileSize: number | null,
  messageId?: number
) {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO attachments (conversation_id, message_id, file_name, file_url, file_type, file_size)
    VALUES (${conversationId}, ${messageId || null}, ${fileName}, ${fileUrl}, ${fileType}, ${fileSize})
    RETURNING *
  `;
  return rows[0];
}

// ── Briefs ──

export async function findOrCreateConversation(agentId: string, createdBy: string) {
  const sql = getDb();
  // Find most recent non-archived conversation
  const existing = await sql`
    SELECT * FROM conversations
    WHERE agent_id = ${agentId} AND archived = false
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (existing.length > 0) return existing[0];
  // Create new one
  const rows = await sql`
    INSERT INTO conversations (agent_id, title, created_by)
    VALUES (${agentId}, ${'Brief conversation'}, ${createdBy})
    RETURNING *
  `;
  return rows[0];
}

// ── Business Plan ──

export async function getBusinessPlanSections() {
  const sql = getDb();
  return sql`
    SELECT * FROM business_plan_sections
    ORDER BY sort_order ASC
  `;
}

export async function updateBusinessPlanSection(sectionKey: string, content: string, updatedBy: string) {
  const sql = getDb();
  const rows = await sql`
    UPDATE business_plan_sections
    SET content = ${content}, last_updated = NOW(), updated_by = ${updatedBy}
    WHERE section_key = ${sectionKey}
    RETURNING *
  `;
  return rows[0];
}

export async function getBusinessPlanSnapshots() {
  const sql = getDb();
  return sql`
    SELECT id, changes_summary, created_at
    FROM business_plan_snapshots
    ORDER BY created_at DESC
    LIMIT 20
  `;
}

export async function createBusinessPlanSnapshot(fullContent: string, changesSummary: string) {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO business_plan_snapshots (full_content, changes_summary)
    VALUES (${fullContent}, ${changesSummary})
    RETURNING *
  `;
  return rows[0];
}

export async function getBusinessPlanSnapshot(id: number) {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM business_plan_snapshots WHERE id = ${id}
  `;
  return rows[0];
}

// ── Agent Views ──

export async function getAgentView(agentId: string) {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM agent_views WHERE agent_id = ${agentId} LIMIT 1
  `;
  return rows[0] || null;
}

export async function upsertAgentView(agentId: string, content: string, generatedBy: string) {
  const sql = getDb();
  // Try update first
  const existing = await sql`SELECT id FROM agent_views WHERE agent_id = ${agentId}`;
  if (existing.length > 0) {
    const rows = await sql`
      UPDATE agent_views
      SET content = ${content}, generated_by = ${generatedBy}, generated_at = NOW()
      WHERE agent_id = ${agentId}
      RETURNING *
    `;
    return rows[0];
  }
  const rows = await sql`
    INSERT INTO agent_views (agent_id, content, generated_by)
    VALUES (${agentId}, ${content}, ${generatedBy})
    RETURNING *
  `;
  return rows[0];
}

export async function getAllMessagesForAgent(agentId: string) {
  const sql = getDb();
  return sql`
    SELECT m.content, m.role, m.user_name, m.created_at, c.title as conversation_title
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.agent_id = ${agentId}
    ORDER BY m.created_at ASC
  `;
}

// ── Context Files (shared army-wide) ──

export async function getContextFiles() {
  const sql = getDb();
  return sql`
    SELECT * FROM context_files
    ORDER BY created_at DESC
  `;
}

export async function createContextFile(
  fileName: string,
  fileUrl: string,
  fileType: string | null,
  fileSize: number | null,
  uploadedBy: string,
  description: string | null
) {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO context_files (file_name, file_url, file_type, file_size, uploaded_by, description)
    VALUES (${fileName}, ${fileUrl}, ${fileType}, ${fileSize}, ${uploadedBy}, ${description})
    RETURNING *
  `;
  return rows[0];
}

export async function deleteContextFile(id: number) {
  const sql = getDb();
  return sql`DELETE FROM context_files WHERE id = ${id} RETURNING *`;
}

// ── User Activity ──

export async function upsertUserActivity(userName: string, agentId?: string) {
  const sql = getDb();
  const existing = await sql`SELECT id FROM user_activity WHERE user_name = ${userName}`;
  if (existing.length > 0) {
    if (agentId) {
      await sql`UPDATE user_activity SET last_active = NOW(), last_agent_id = ${agentId} WHERE user_name = ${userName}`;
    } else {
      await sql`UPDATE user_activity SET last_active = NOW() WHERE user_name = ${userName}`;
    }
  } else {
    await sql`INSERT INTO user_activity (user_name, last_agent_id) VALUES (${userName}, ${agentId || null})`;
  }
}

export async function getUserActivity() {
  const sql = getDb();
  return sql`SELECT * FROM user_activity ORDER BY last_active DESC`;
}

// ── Schema Setup ──

export async function initializeSchema() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      agent_id VARCHAR(50) NOT NULL,
      title VARCHAR(255),
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW(),
      archived BOOLEAN DEFAULT FALSE
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      user_name VARCHAR(100),
      pinned BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS agent_facts (
      id SERIAL PRIMARY KEY,
      agent_id VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS attachments (
      id SERIAL PRIMARY KEY,
      message_id INTEGER,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      file_name VARCHAR(255) NOT NULL,
      file_url TEXT NOT NULL,
      file_type VARCHAR(100),
      file_size INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS business_plan_sections (
      id SERIAL PRIMARY KEY,
      section_key VARCHAR(50) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      last_updated TIMESTAMP DEFAULT NOW(),
      updated_by VARCHAR(100) DEFAULT 'system'
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS business_plan_snapshots (
      id SERIAL PRIMARY KEY,
      full_content TEXT NOT NULL,
      changes_summary TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS context_files (
      id SERIAL PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL,
      file_url TEXT NOT NULL,
      file_type VARCHAR(100),
      file_size INTEGER,
      uploaded_by VARCHAR(100),
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS agent_views (
      id SERIAL PRIMARY KEY,
      agent_id VARCHAR(50) UNIQUE NOT NULL,
      content TEXT NOT NULL,
      generated_by VARCHAR(100),
      generated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS user_activity (
      id SERIAL PRIMARY KEY,
      user_name VARCHAR(100) UNIQUE NOT NULL,
      last_active TIMESTAMP DEFAULT NOW(),
      last_agent_id VARCHAR(50)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(agent_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_agent_facts_agent ON agent_facts(agent_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_attachments_conversation ON attachments(conversation_id)`;
}
