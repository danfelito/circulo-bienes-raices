import React from 'react';
import { Link } from 'react-router-dom';

const BrandLogo = ({ compact = false, className = '' }) => (
  <Link
    to="/"
    aria-label="Círculo Internacional de Bienes Raíces"
    className={`inline-flex items-center gap-3 min-w-0 ${className}`}
  >
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      className={`${compact ? 'h-10 w-10' : 'h-12 w-12'} shrink-0`}
    >
      <circle cx="32" cy="32" r="29" fill="#d71920" />
      <path d="M15 31.5 32 17l17 14.5v17a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3v-17Z" fill="white" />
      <path d="M23 51V35h18v16" fill="#d71920" />
      <path d="M29 51V41h6v10" fill="white" />
    </svg>

    <span className="flex min-w-0 flex-col leading-none">
      <span className={`${compact ? 'text-[10px]' : 'text-[11px] sm:text-xs'} font-semibold tracking-[0.22em] text-[#d71920] whitespace-nowrap`}>
        CÍRCULO INTERNACIONAL
      </span>
      <span className={`${compact ? 'text-lg' : 'text-xl sm:text-2xl'} font-black tracking-[-0.035em] text-black whitespace-nowrap`}>
        BIENES RAÍCES
      </span>
    </span>
  </Link>
);

export default BrandLogo;
