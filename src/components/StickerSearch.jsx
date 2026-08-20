export function StickerSearch({ value, onChange }) {
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-xl bg-neutral-800/80 px-2.5 py-1.5">
      <span className="text-sm leading-none">😍</span>
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search stickers"
        className="w-full bg-transparent text-[13px] text-neutral-100 outline-none placeholder:text-neutral-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-neutral-500 hover:text-neutral-200"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  )
}
