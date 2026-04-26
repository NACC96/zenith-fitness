import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Write an audit log entry. Call this from other mutations before
 * destructive operations (delete, set removal, bulk update).
 */
export async function writeAuditLog(
  ctx: { db: any },
  entry: {
    action: string;
    table: string;
    documentId: string;
    snapshot: any;
    metadata?: any;
  }
) {
  await ctx.db.insert("auditLog", {
    ...entry,
    timestamp: Date.now(),
  });
}

// Query recent audit log entries
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const take = args.limit ?? 50;
    return await ctx.db
      .query("auditLog")
      .withIndex("by_timestamp")
      .order("desc")
      .take(take);
  },
});

// Query audit log by table
export const listByTable = query({
  args: { table: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const take = args.limit ?? 50;
    return await ctx.db
      .query("auditLog")
      .withIndex("by_table", (q) => q.eq("table", args.table))
      .order("desc")
      .take(take);
  },
});
