import React from 'react';

type Obra10LogoProps = {
  /** Tamanho do ícone (quadrado). */
  size?: number;
  /** Se true, mostra "OBRA 10" ao lado do ícone. */
  withWordmark?: boolean;
  /** Cor do texto (ex.: text-white no painel vermelho). */
  wordmarkClassName?: string;
  className?: string;
  alt?: string;
};

/**
 * Logo Obra 10 — ícone da arte fornecida pelo usuário.
 * withWordmark: ícone + "OBRA 10" (capacete ~altura do texto).
 */
export const Obra10Logo: React.FC<Obra10LogoProps> = ({
  size = 40,
  withWordmark = false,
  wordmarkClassName = 'text-white',
  className = '',
  alt = 'Obra 10',
}) => {
  const icon = (
    <img
      src="/logo-obra10.png?v=2.6.2"
      width={size}
      height={size}
      alt={withWordmark ? '' : alt}
      className={`shrink-0 object-contain rounded-[22%] ${withWordmark ? '' : className}`}
      draggable={false}
    />
  );

  if (!withWordmark) return icon;

  return (
    <div className={`flex items-center gap-3.5 ${className}`} aria-label={alt}>
      {icon}
      <span
        className={`font-extrabold tracking-tight leading-none ${wordmarkClassName}`}
        style={{ fontSize: Math.round(size * 0.58) }}
      >
        OBRA 10
      </span>
    </div>
  );
};

export default Obra10Logo;
