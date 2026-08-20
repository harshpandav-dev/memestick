import { StickerCard } from './StickerCard'

export function StickerGrid({ stickers, loading, onPick }) {
  if (loading)
    return <p className="py-10 text-center text-[12px] text-neutral-500">Loading…</p>
  if (!stickers.length)
    return <p className="py-10 text-center text-[12px] text-neutral-500">No stickers found</p>

  return (
    <div className="grid grid-cols-4 gap-1.5 pb-1 @[320px]:grid-cols-5">
      {stickers.map((s) => (
        <StickerCard key={s.id} sticker={s} onPick={onPick} />
      ))}
    </div>
  )
}
