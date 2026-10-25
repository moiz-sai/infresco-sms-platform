import { storage } from './storage'

export type ReceiptFormat = '80' | 'a4'
const FORMAT_KEY = 'sms.receiptFormat'

export const receiptFormat = {
  get: (): ReceiptFormat => (storage.get<ReceiptFormat>(FORMAT_KEY) === 'a4' ? 'a4' : '80'),
  set: (f: ReceiptFormat) => storage.set(FORMAT_KEY, f),
}

// Prints the receipt page from a hidden iframe so the collection screen stays open.
export function printReceipt(receiptId: string, format: ReceiptFormat) {
  const frame = document.createElement('iframe')
  frame.src = `/print/receipt/${receiptId}?format=${format}&autoprint=1`
  frame.setAttribute('aria-hidden', 'true')
  Object.assign(frame.style, {
    position: 'fixed',
    width: '0',
    height: '0',
    border: '0',
    right: '0',
    bottom: '0',
  })
  document.body.appendChild(frame)
  setTimeout(() => frame.remove(), 120_000)
}
