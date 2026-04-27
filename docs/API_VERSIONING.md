# Versionamento da API — Obra 10

## Estratégia: Versionamento por Header (quando necessário)

Atualmente a API não tem versionamento explícito. Quando for necessário
fazer breaking changes em endpoints existentes:

1. Manter o endpoint antigo funcionando (v1)
2. Criar o novo endpoint com o comportamento atualizado (v2)
3. Adicionar header `X-API-Version` nos requests
4. O frontend envia o header com a versão que espera
5. Após 3 meses, depreciar a v1 (log warning nos requests)
6. Após 6 meses, remover a v1

---

## Regra de ouro

| Tipo de mudança | Breaking change? | Ação necessária |
|-----------------|-----------------|-----------------|
| Adicionar campos novos na response | ❌ Não | Nenhuma |
| Remover campos da response | ✅ Sim | Versionar |
| Mudar tipo de campo | ✅ Sim | Versionar |
| Adicionar endpoint novo | ❌ Não | Nenhuma |
| Mudar assinatura de endpoint | ✅ Sim | Versionar |

---

## Implementação atual

O middleware `ApiVersionMiddleware` está registrado e lê o header `X-API-Version` de cada request. O valor é acessível via `req.apiVersion` em qualquer controller.

**Nenhum controller usa versionamento por enquanto** — esta infraestrutura está preparada para quando for necessário.

### Exemplo de uso futuro:
```typescript
@Get('dados')
async getDados(@Req() req: any) {
  if (req.apiVersion === '2') {
    return this.service.getDadosV2();
  }
  return this.service.getDadosV1();
}
```

---

## Middleware registrado em:
- `src/core/middlewares/api-version.middleware.ts`
- Aplicado globalmente via `app.module.ts`
