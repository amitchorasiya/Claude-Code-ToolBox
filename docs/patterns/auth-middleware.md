# Pattern: Auth Middleware

Every API endpoint MUST use authentication middleware unless explicitly public.

## Express.js Example

```javascript
import { verifyToken } from './auth.js';

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Usage
app.get('/api/users', requireAuth, requireRole('admin'), getUsers);
app.get('/api/profile', requireAuth, getProfile);
app.get('/api/health', getHealth); // Explicitly public — no middleware
```

## Next.js API Route Example

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // User is authenticated — proceed
  const data = await fetchUserData(session.user.id);
  return Response.json(data);
}
```

## Django Example

```python
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_profile(request):
    return Response(UserSerializer(request.user).data)
```

## Rules

1. Auth middleware runs BEFORE any business logic
2. Failed auth returns 401 (not authenticated) or 403 (not authorized)
3. Never expose error details that reveal system internals
4. Public endpoints must be explicitly documented in a manifest
