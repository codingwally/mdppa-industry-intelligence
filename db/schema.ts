import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const intelligence=sqliteTable('intelligence',{id:text('id').primaryKey(),url:text('url').notNull().unique(),payload:text('payload').notNull(),updatedAt:text('updated_at').notNull()});
export const sourceHealth=sqliteTable('source_health',{id:text('id').primaryKey(),payload:text('payload').notNull()});
export const crawlRuns=sqliteTable('crawl_runs',{id:text('id').primaryKey(),payload:text('payload').notNull()});
export const queue=sqliteTable('review_queue',{id:text('id').primaryKey(),recordId:text('record_id').notNull().unique(),payload:text('payload').notNull()});
export const recipients=sqliteTable('recipients',{id:text('id').primaryKey(),name:text('name').notNull(),email:text('email').notNull(),active:integer('active').notNull().default(1)});
export const history=sqliteTable('send_history',{id:text('id').primaryKey(),payload:text('payload').notNull()});
export const audit=sqliteTable('audit_log',{id:text('id').primaryKey(),createdAt:text('created_at').notNull(),payload:text('payload').notNull()});
export const settings=sqliteTable('settings',{id:text('id').primaryKey(),payload:text('payload').notNull()});
