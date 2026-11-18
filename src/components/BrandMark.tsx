import React from 'react';

export function FormaCareLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="32" height="32" rx="8" fill="#16834B" />
      <path
        d="M9 16.5L13.8 21.2L23.2 11.2"
        stroke="#FFFFFF"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23.5" cy="21.5" r="2.5" fill="#E8F5ED" />
    </svg>
  );
}

export function TrainerAvatar({
  name,
  photoUrl,
  sizeClass = 'w-10 h-10',
}: {
  name: string;
  photoUrl?: string;
  sizeClass?: string;
}) {
  const [imgError, setImgError] = React.useState(false);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover border border-[#E5E7EB] shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-[#E8F5ED] text-[#16834B] font-semibold text-xs flex items-center justify-center border border-[#16834B]/15 shrink-0`}
      aria-label={name}
    >
      {initials || 'FR'}
    </div>
  );
}
