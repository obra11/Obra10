import { mergePermissoesObra } from './role-capabilities';

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

  it('preenche RDO do papel se a obra não tiver permissão', () => {
    const out = mergePermissoesObra(
      {},
      { criarEditarRdo: true, modulosPadrao: { RDO: 'EDIT' } },
    );
    expect(out.RDO).toBe('EDIT');
  });
});
