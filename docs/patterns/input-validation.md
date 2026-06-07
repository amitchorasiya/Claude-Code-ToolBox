# Pattern: Input Validation

ALL user input is validated server-side. Client-side validation is UX only — never a security boundary.

## Zod Schema Validation (TypeScript)

```typescript
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100).trim(),
  age: z.number().int().min(13).max(150).optional(),
  role: z.enum(['user', 'moderator']),  // Allowlist, not blocklist
});

export async function POST(request: Request) {
  const body = await request.json();

  const result = CreateUserSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }

  // result.data is typed and validated — safe to use
  const user = await createUser(result.data);
  return Response.json(user, { status: 201 });
}
```

## Parameterized Queries (Anti-SQLi)

```javascript
// CORRECT: Parameterized query
const user = await db.query(
  'SELECT * FROM users WHERE email = $1 AND status = $2',
  [email, 'active']
);

// CORRECT: ORM with built-in parameterization
const user = await prisma.user.findUnique({
  where: { email: validatedEmail }
});

// WRONG: String concatenation — SQL injection vulnerability
// const user = await db.query(`SELECT * FROM users WHERE email = '${email}'`);
```

## Output Sanitization (Anti-XSS)

```typescript
// React: JSX auto-escapes by default — this is safe
return <p>{userInput}</p>;

// DANGEROUS: dangerouslySetInnerHTML bypasses escaping
// return <div dangerouslySetInnerHTML={{ __html: userInput }} />;

// If you MUST render HTML, use a sanitizer
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);
```

## File Upload Validation

```typescript
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function handleUpload(file: File) {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('Invalid file type');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large');
  }

  // Validate magic bytes, not just extension
  const buffer = await file.arrayBuffer();
  const header = new Uint8Array(buffer.slice(0, 4));
  if (!isValidImageHeader(header)) {
    throw new Error('File content does not match declared type');
  }

  // Generate a random filename — never use user-provided names directly
  const filename = `${crypto.randomUUID()}.${getExtension(file.type)}`;
  await uploadToStorage(filename, buffer);
}
```

## Rules

1. Validate on the server. Always. Client validation is cosmetic.
2. Use schema validation libraries (Zod, Joi, Pydantic) — don't write regex by hand.
3. Allowlist valid input rather than blocklisting bad input.
4. Parameterize all database queries. No string concatenation. Ever.
5. Sanitize output in the rendering layer. Don't trust stored data to be clean.
6. Reject requests with unexpected fields — don't silently ignore them.
