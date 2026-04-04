import Image from "next/image";

type CombatantPortraitProps = {
  src: string;
  alt: string;
  className?: string;
};

export function CombatantPortrait({
  src,
  alt,
  className = "",
}: CombatantPortraitProps) {
  return (
    <div
      className={`relative aspect-[3/4] w-full max-h-44 overflow-hidden rounded-xl border border-white/15 bg-black/50 shadow-inner shadow-black/40 ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover object-top"
        sizes="(max-width: 640px) 45vw, 200px"
        priority={false}
      />
    </div>
  );
}
