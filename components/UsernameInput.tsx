"use client";

type UsernameInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function UsernameInput({
  value,
  onChange,
  disabled,
}: UsernameInputProps) {
  return (
    <div className="flex w-full max-w-xs flex-col gap-2 self-center">
      <label className="text-center text-xs font-medium uppercase tracking-widest text-zinc-500">
        Name
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-zinc-700 bg-zinc-900/90 px-4 py-3 text-center text-base text-zinc-100 outline-none ring-amber-500/40 transition placeholder:text-zinc-600 focus:border-amber-500/60 focus:ring-2"
        placeholder="Enter your name"
        autoComplete="username"
        disabled={disabled}
        maxLength={32}
      />
    </div>
  );
}
