export function StickerButton({ rect, active, onClick }) {
  return (
    <button
      type="button"
      aria-label="Open stickers"
      onMouseDown={(e) => e.preventDefault()} // keep focus in the field
      onClick={onClick}
      style={{ top: rect.top + rect.height / 2 - 11, left: rect.right - 28 }}
      className={`fixed z-[2147483646] grid h-[22px] w-[22px] place-items-center rounded-full
        border border-white/10 bg-neutral-900/80 text-[13px] leading-none shadow-sm
        backdrop-blur transition hover:scale-110 hover:bg-neutral-800
        ${active ? 'scale-110 ring-1 ring-indigo-400' : 'opacity-70 hover:opacity-100'}`}
    >
      🙂
    </button>
  )
}
