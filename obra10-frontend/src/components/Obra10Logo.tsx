import React from 'react';

type Obra10LogoProps = {
  /**
   * Altura do ícone (tile). No lockup, o texto "OBRA 10" fica
   * na mesma altura visual do tile — proporção do brand.
   */
  size?: number;
  /** Se true, mostra "OBRA 10" ao lado do ícone. */
  withWordmark?: boolean;
  /** Cor do texto (ex.: text-white no painel vermelho). */
  wordmarkClassName?: string;
  className?: string;
  alt?: string;
};

/**
 * Logo Obra 10.
 * - No vermelho: tile com moldura branca (visível) + OBRA 10 na mesma altura.
 * - No claro: tile vermelho sólido + texto escuro.
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

  const iconSrc = onRed
    ? '/logo-obra10-framed.png?v=2.6.3'
    : '/logo-obra10.png?v=2.6.3';

  // Texto ≈ altura do tile (como no banner de marca)
  const textPx = Math.round(size * 0.82);

  const icon = (
    <img
      src={withWordmark ? iconSrc : `/logo-obra10.png?v=2.6.3`}
      width={size}
      height={size}
      alt={withWordmark ? '' : alt}
      className={`shrink-0 object-contain rounded-[22%] ${withWordmark ? '' : className}`}
      draggable={false}
    />
  );

  if (!withWordmark) return icon;

  return (
    <div className={`flex items-center gap-3 ${className}`} aria-label={alt}>
      {icon}
      <span
        className={`font-extrabold tracking-tight leading-none ${wordmarkClassName}`}
        style={{ fontSize: textPx }}
      >
        OBRA 10
      </span>
    </div>
  );
};

export default Obra10Logo;
