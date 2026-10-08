import { mergePermissoesObra, podeReceberAprovacao } from './role-capabilities';

describe('mergePermissoesObra', () => {
  it('sobe VIEW para EDIT quando o papel permite criar/editar RDO', () => {
    const out = mergePermissoesObra(
      { RDO: 'VIEW' },
      { criarEditarRdo: true, modulosPadrao: { RDO: 'EDIT' } },
    );
    expect(out.RDO).toBe('EDIT');
  });

  it('mantém VIEW_APPROVED mesmo com criarEditarRdo', () => {
    const out = mergePermissoesObra(
      { RDO: 'VIEW_APPROVED' },
      { criarEditarRdo: true, modulosPadrao: { RDO: 'EDIT' } },
    );
    expect(out.RDO).toBe('VIEW_APPROVED');
  });

  it('sobe VIEW para EDIT nos outros módulos quando a função permite editar', () => {
    const out = mergePermissoesObra(
      { FVS: 'VIEW', RDO: 'VIEW' },
      { criarEditarRdo: true, modulosPadrao: { RDO: 'EDIT', FVS: 'EDIT' } },
    );
    expect(out.RDO).toBe('EDIT');
    expect(out.FVS).toBe('EDIT');
  });

  it('não manda aprovação para colaborador ou externo sem autorização', () => {
    expect(
      podeReceberAprovacao({
        perfilGlobal: 'USER',
        aprovarRdo: false,
        vinculadoAObra: true,
      }),
    ).toBe(false);
    expect(
      podeReceberAprovacao({
        perfilGlobal: 'EXTERNO',
        aprovarRdo: false,
        vinculadoAObra: true,
      }),
    ).toBe(false);
    expect(
      podeReceberAprovacao({
        perfilGlobal: 'USER',
        aprovarRdo: true,
        vinculadoAObra: false,
      }),
    ).toBe(false);
  });

  it('aceita quem está na obra com Aprovar RDO, ou o gestor da empresa', () => {
    expect(
      podeReceberAprovacao({
        perfilGlobal: 'USER',
        aprovarRdo: true,
        vinculadoAObra: true,
      }),
    ).toBe(true);
    expect(
      podeReceberAprovacao({
        perfilGlobal: 'GESTOR',
        acessoTodasObras: true,
        vinculadoAObra: false,
      }),
    ).toBe(true);
  });

  it('preenche RDO do papel se a obra não tiver permissão', () => {
    const out = mergePermissoesObra(
      {},
      { criarEditarRdo: true, modulosPadrao: { RDO: 'EDIT' } },
    );
    expect(out.RDO).toBe('EDIT');
  });
});
