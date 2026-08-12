import React from 'react';

type Obra10LogoProps = {
  size?: number;
  className?: string;
  alt?: string;
};

/** Marca oficial Obra 10 (capacete branco em vermelho). */
export const Obra10Logo: React.FC<Obra10LogoProps> = ({
  size = 40,
  className = '',
  alt = 'Obra 10',
}) => (
  <img
    src="/logo-obra10.png"
    width={size}
    height={size}
    alt={alt}
    className={`shrink-0 object-contain ${className}`}
    draggable={false}
  />
);

export default Obra10Logo;
