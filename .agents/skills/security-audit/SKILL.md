# 🛠️ Skill: Security Audit

- JWT: expiração 1h, HttpOnly cookie, renovação silenciosa
- Lockout: por email (não IP), limite de 5 tentativas, bloqueio de 15 min
- XSS: sanitização via regex, sem bibliotecas externas
- Rate limiting: 100 req/min por usuário autenticado, 20 req/min para rotas públicas
- LGPD: endpoints de exportação e exclusão de dados obrigatórios
- CSRF: token em header para todas as mutations
