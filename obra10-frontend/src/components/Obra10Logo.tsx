import React from 'react';

type Obra10LogoProps = {
  /** Tamanho do ícone (quadrado). */
  size?: number;
  /** Se true, mostra "OBRA 10" ao lado do ícone. */
  withWordmark?: boolean;
  /** Variante de cor do texto do wordmark. */
  wordmarkClassName?: string;
  className?: string;
  alt?: string;
};

/**
 * Marca interna Obra 10: capacete branco em vermelho (PNG oficial).
 * Use withWordmark nas telas de login/headers.
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
      src="/logo-obra10.png?v=2.5.4"
      width={size}
      height={size}
      alt={withWordmark ? '' : alt}
      className={`shrink-0 object-contain rounded-xl ${withWordmark ? '' : className}`}
      draggable={false}
    />
  );

  if (!withWordmark) return icon;

  return (
    <div className={`flex items-center gap-3 ${className}`} aria-label={alt}>
      {icon}
      <span
        className={`font-extrabold tracking-tight leading-none ${wordmarkClassName}`}
        style={{ fontSize: Math.round(size * 0.72) }}
      >
        OBRA 10
      </span>
    </div>
  );
};

export default Obra10Logo;
