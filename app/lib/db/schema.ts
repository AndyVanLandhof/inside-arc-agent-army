import { pgTable, serial, varchar, text, timestamp, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  agentId: varchar('agent_id', { length: 50 }).notNull(),
  title: varchar('title', { length: 200 }).notNull().default('New Conversation'),
  status: varchar('status', { length: 10 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  agentId: varchar('agent_id', { length: 50 }).notNull(),
  conversationId: integer('conversation_id'),
  role: varchar('role', { length: 10 }).notNull(),
  content: text('content').notNull(),
  userName: varchar('user_name', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
