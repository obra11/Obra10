import React from 'react';

type Obra10LogoProps = {
  /**
   * Altura do capacete. Com wordmark, o texto "OBRA 10"
   * usa a mesma altura (proporção da arte LOGO2).
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
 * Logo Obra 10 — proporção da arte fornecida:
 * capacete branco (sem tile) + "OBRA 10" na mesma altura.
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

  // No vermelho: só o capacete branco. No claro: tile vermelho (legível).
  const iconSrc = withWordmark
    ? onRed
      ? '/logo-obra10-hat.png?v=2.6.4'
      : '/logo-obra10.png?v=2.6.4'
    : '/logo-obra10.png?v=2.6.4';

  // Proporção LOGO2: altura do capacete ≈ altura das maiúsculas
  const textPx = withWordmark && onRed ? size : Math.round(size * 0.82);
  const iconH = size;
  // Capacete da arte é um pouco mais largo que alto
  const iconW = withWordmark && onRed ? Math.round(size * 1.25) : size;

  const icon = (
    <img
      src={iconSrc}
      width={iconW}
      height={iconH}
      alt={withWordmark ? '' : alt}
      className={`shrink-0 object-contain ${withWordmark && onRed ? '' : 'rounded-[22%]'} ${withWordmark ? '' : className}`}
      draggable={false}
    />
  );

  if (!withWordmark) return icon;

  return (
    <div className={`flex items-center gap-2.5 ${className}`} aria-label={alt}>
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
