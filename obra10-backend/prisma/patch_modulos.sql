-- Add new columns to modulos (safe IF NOT EXISTS via DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='modulos' AND column_name='sigla') THEN
    ALTER TABLE modulos ADD COLUMN sigla TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='modulos' AND column_name='grupo') THEN
    ALTER TABLE modulos ADD COLUMN grupo TEXT NOT NULL DEFAULT 'GERAL';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='modulos' AND column_name='versao') THEN
    ALTER TABLE modulos ADD COLUMN versao TEXT NOT NULL DEFAULT '1.0.0';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='modulos' AND column_name='dependencias') THEN
    ALTER TABLE modulos ADD COLUMN dependencias TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='modulos' AND column_name='ordem_exibicao') THEN
    ALTER TABLE modulos ADD COLUMN ordem_exibicao INTEGER NOT NULL DEFAULT 99;
  END IF;
END $$;

-- Create submodulos table
CREATE TABLE IF NOT EXISTS submodulos (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  modulo_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT submodulos_pkey PRIMARY KEY (id),
  CONSTRAINT submodulos_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES modulos(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS submodulos_modulo_id_slug_key ON submodulos(modulo_id, slug);

-- Create integracoes_modulos table
CREATE TABLE IF NOT EXISTS integracoes_modulos (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  modulo_origem TEXT NOT NULL,
  modulo_destino TEXT NOT NULL,
  evento TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT integracoes_modulos_pkey PRIMARY KEY (id)
);
