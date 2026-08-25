import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 'md', showSubtitle = true }) => {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  if (isLg) {
    return (
      <div className="flex items-center justify-center select-none">
        <img
          src="/branding/mentoria-a-mecanica.jpg"
          alt="Mentoria A Mecânica — Trader Thiago"
          className="w-44 h-44 sm:w-52 sm:h-52 object-cover rounded-2xl shadow-2xl shadow-amber-950/40 ring-1 ring-amber-500/20"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 select-none">
      <div className={`relative shrink-0 rounded-xl bg-[#090909] p-0.5 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500/40 ${isSm ? 'w-9 h-9' : 'w-11 h-11'}`}>
        <img src="/branding/mentoria-mark.jpg" alt="Símbolo Mentoria A Mecânica" className="w-full h-full object-cover rounded-[10px]" />
      </div>

      <div className="flex flex-col text-left">
        <div className="flex items-center gap-1.5">
          <span className={`font-black tracking-tight uppercase text-white ${isSm ? 'text-sm' : 'text-base font-extrabold'}`}>
            A MECÂNICA<span className="text-amber-400">.</span>
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/25 uppercase tracking-widest hidden sm:inline-block">
            TRADER
          </span>
        </div>
        {showSubtitle && <span className="text-[10px] font-medium text-neutral-400 tracking-wider uppercase">Mentoria Trader Thiago</span>}
      </div>
    </div>
  );
};
