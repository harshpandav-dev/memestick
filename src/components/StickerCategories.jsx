export function StickerCategories({ categories, active, onSelect }) {
  return (
    <div className="-mx-1 flex shrink-0 gap-1 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] whitespace-nowrap transition
            ${c.id === active ? 'bg-indigo-500 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
        >
          <span>{c.emoji}</span>
          {c.label}
        </button>
      ))}
    </div>
  )
}
