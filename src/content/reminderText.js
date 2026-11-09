// Reminder wording (A.23 in-app, A.24 email). Shared by the server's email
// and the in-app list. No financial figures, ever (B.7).
export const REMINDER_TYPES = ['zakatMonth', 'ramadan', 'friday', 'dhulHijjah']

export const reminderText = {
  zakatMonth: {
    label: 'My Zakat month',
    when: 'Every day of the Hijri month of your Zakat date.',
    subject: 'Your Zakat month',
    body: 'Your Zakat month has begun. When you are ready, CharityFlow can help you work out what is due.',
  },
  ramadan: {
    label: 'Ramadan',
    when: 'Every day of Ramadan.',
    subject: 'Ramadan reminder',
    body: 'It is Ramadan. A small gift today counts.',
  },
  friday: {
    label: 'Fridays',
    when: 'Every Friday.',
    subject: 'Friday reminder',
    body: 'It is Friday, a good day for a small act of charity.',
  },
  dhulHijjah: {
    label: 'Dhul-Hijjah',
    when: 'The first day of Dhul-Hijjah.',
    subject: 'Dhul-Hijjah reminder',
    body: 'The first ten days of Dhul-Hijjah have begun, among the best days for good deeds.',
  },
}
