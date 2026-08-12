import React from 'react';

type Obra10LogoProps = {
  /** Altura do lockup (ou do ícone sem wordmark). */
  size?: number;
  /** Se true, usa a arte LOGO2 completa (capacete + OBRA 10). */
  withWordmark?: boolean;
  /** No claro: texto escuro; no vermelho: usa a arte branca transparente. */
  wordmarkClassName?: string;
  className?: string;
  alt?: string;
};

/**
 * Logo Obra 10 — arte exata fornecida (LOGO2), sem remontar por CSS.
 */
export const Obra10Logo: React.FC<Obra10LogoProps> = ({
  size = 40,
  withWordmark = false,
  wordmarkClassName = 'text-white',
  className = '',
  alt = 'Obra 10',
}) => {
  const onRed =
    /\btext-white\b/.test(wordmarkClassName) || wordmarkClassName.includes('white');

  if (withWordmark && onRed) {
    // Arte LOGO2 completa — proporção idêntica à que o usuário enviou
    // Lockup ~220×45 → aspect ≈ 4.9
    const height = size;
    const width = Math.round(size * 4.9);
    return (
      <img
        src="/obra10-lockup-transparent.png?v=2.6.5"
        width={width}
        height={height}
        alt={alt}
        className={`shrink-0 object-contain object-left ${className}`}
        draggable={false}
      />
    );
  }

  if (withWordmark) {
    // Fundo claro: ícone vermelho + texto escuro
    return (
      <div className={`flex items-center gap-2.5 ${className}`} aria-label={alt}>
        <img
          src="/logo-obra10.png?v=2.6.5"
          width={size}
          height={size}
          alt=""
          className="shrink-0 object-contain rounded-[22%]"
          draggable={false}
        />
        <span
          className={`font-extrabold tracking-tight leading-none ${wordmarkClassName}`}
          style={{ fontSize: Math.round(size * 0.82) }}
        >
          OBRA 10
        </span>
      </div>
    );
  }

  return (
    <img
      src={`/logo-obra10.png?v=2.6.5`}
      width={size}
      height={size}
      alt={alt}
      className={`shrink-0 object-contain rounded-[22%] ${className}`}
      draggable={false}
    />
  );
};

export default Obra10Logo;
