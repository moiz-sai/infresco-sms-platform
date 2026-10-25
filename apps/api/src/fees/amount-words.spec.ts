import { amountInWords, amountInWordsUr } from '@sms/shared';

describe('amount in words (receipts)', () => {
  it.each([
    [50000, 'Five hundred rupees only', 'پانچ سو روپے صرف'],
    [
      350000,
      'Three thousand five hundred rupees only',
      'تین ہزار پانچ سو روپے صرف',
    ],
    [
      10050000,
      'One lakh five hundred rupees only',
      'ایک لاکھ پانچ سو روپے صرف',
    ],
    [
      123456789,
      'Twelve lakh thirty-four thousand five hundred sixty-seven rupees and eighty-nine paisa only',
      'بارہ لاکھ چونتیس ہزار پانچ سو سڑسٹھ روپے اور نواسی پیسے صرف',
    ],
    [
      2500000000,
      'Two crore fifty lakh rupees only',
      'دو کروڑ پچاس لاکھ روپے صرف',
    ],
  ])('%i paisa', (paisa, en, ur) => {
    expect(amountInWords(paisa)).toBe(en);
    expect(amountInWordsUr(paisa)).toBe(ur);
  });
});
