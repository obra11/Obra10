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
 * Marca Obra 10 — primeiro logo (capacete preenchido).
 * withWordmark: capacete + texto "OBRA 10".
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
      src="/obra10-mark.svg?v=2.5.8"
      width={size}
      height={size}
      alt={withWordmark ? '' : alt}
      className={`shrink-0 object-contain ${withWordmark ? '' : className}`}
      draggable={false}
    />
  );

  if (!withWordmark) return icon;

  return (
    <div className={`flex items-center gap-3.5 ${className}`} aria-label={alt}>
      {icon}
      <span
        className={`font-extrabold tracking-tight leading-none ${wordmarkClassName}`}
        style={{ fontSize: Math.round(size * 0.7) }}
      >
        OBRA 10
      </span>
    </div>
  );
};

export default Obra10Logo;
