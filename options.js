const input = document.getElementById('key')
const saved = document.getElementById('saved')

chrome.storage.sync.get('giphyKey').then(({ giphyKey }) => (input.value = giphyKey || ''))

document.getElementById('save').addEventListener('click', async () => {
  await chrome.storage.sync.set({ giphyKey: input.value.trim() })
  saved.textContent = 'Saved'
  setTimeout(() => (saved.textContent = ''), 1500)
})
