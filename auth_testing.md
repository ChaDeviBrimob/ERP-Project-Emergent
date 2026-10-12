# Auth Testing Playbook (VRCHINDO ERP)

## JWT login
curl -c cookies.txt -X POST $URL/api/auth/login -H "Content-Type: application/json" -d '{"email":"chadevibrimob@gmail.com","password":"Vrchindo@2026"}'
curl -b cookies.txt $URL/api/auth/me
- Login returns {user, token}; cookies access_token + refresh_token set. Token also accepted as Bearer header.
- No public register; only admin creates users (POST /api/users).
- 5 failed attempts -> 15 min lockout (429).

## Emergent Google Auth
- Frontend redirects to https://auth.emergentagent.com/?redirect=<origin>/ ; returns with #session_id=...
- POST /api/auth/google/session {session_id} -> only succeeds when email already exists in users (else 403).
- Test session: insert into db.user_sessions {user_id: <existing user_id>, session_token, expires_at: +7d} then use cookie session_token or Bearer header.
