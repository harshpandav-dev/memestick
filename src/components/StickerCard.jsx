import { useState } from 'react'

export function StickerCard({ sticker, onPick }) {
  const [hover, setHover] = useState(false) // still PNG in the grid, GIF on hover

  return (
    <button
      type="button"
      title={sticker.name}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => onPick(sticker, !e.shiftKey)} // shift = insert without sending
      className="aspect-square rounded-lg bg-white/[0.03] p-1 transition hover:scale-105 hover:bg-white/10"
    >
      <img
        src={(hover && sticker.gifUrl) || sticker.imageUrl}
        alt={sticker.name}
        width={sticker.width}
        height={sticker.height}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain"
      />
    </button>
  )
}
