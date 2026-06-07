# Pattern: Row Level Security (RLS)

Every database table MUST have RLS policies. No exceptions.

## Supabase / PostgreSQL Example

```sql
-- Enable RLS on the table
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Users can only read their own posts (or public ones)
CREATE POLICY "Users read own posts"
  ON posts FOR SELECT
  USING (
    auth.uid() = user_id
    OR is_public = true
  );

-- Users can only insert their own posts
CREATE POLICY "Users insert own posts"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own posts
CREATE POLICY "Users update own posts"
  ON posts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own posts
CREATE POLICY "Users delete own posts"
  ON posts FOR DELETE
  USING (auth.uid() = user_id);

-- Admin override
CREATE POLICY "Admins full access"
  ON posts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );
```

## Private Messages Example

```sql
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Only sender or recipient can read messages
CREATE POLICY "Participants read messages"
  ON messages FOR SELECT
  USING (
    auth.uid() = sender_id
    OR auth.uid() = recipient_id
  );

-- Only authenticated users can send messages
CREATE POLICY "Authenticated users send messages"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Nobody can update messages (immutable)
-- No UPDATE policy = denied by default with RLS enabled

-- Only sender can delete (soft-delete preferred)
CREATE POLICY "Sender deletes own messages"
  ON messages FOR DELETE
  USING (auth.uid() = sender_id);
```

## Rules

1. ALWAYS enable RLS immediately after creating a table
2. Default deny — with RLS enabled, no access unless a policy grants it
3. Every operation (SELECT, INSERT, UPDATE, DELETE) needs an explicit policy
4. Use `auth.uid()` or equivalent to tie rows to authenticated users
5. Admin access is a separate, explicit policy — never bypass RLS at the application layer
6. Test RLS policies by attempting access as different roles
