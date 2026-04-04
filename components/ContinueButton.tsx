"use client";

type ContinueButtonProps = {
  onClick: () => void;
  disabled: boolean;
  loading?: boolean;
};

export function ContinueButton({
  onClick,
  disabled,
  loading,
}: ContinueButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full max-w-xs self-center rounded-xl bg-gradient-to-b from-amber-500 to-amber-600 px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-zinc-950 shadow-lg shadow-amber-900/30 transition enabled:hover:from-amber-400 enabled:hover:to-amber-500 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading ? "Saving…" : "Continue"}
    </button>
  );
}
