export const COPY = {
  tracker: {
    header: {
      title: 'My Practices',
    },
    day: {
      today: 'Today',
      yesterday: 'Yesterday',
      showToday: 'Show today',
      showYesterday: 'Show yesterday',
    },
    missedDay: {
      title1: 'Did you practice yesterday?',
      body1: 'You can still log it, so your record is complete.',
      title2Named: (name: string) => `Good to see you again, ${name}`,
      title2: 'Good to see you again',
      body2: 'Pick up from where you left off. If you practiced yesterday, you can still log it.',
      title3: 'Welcome back',
      body3: 'Your practice is right where you left it. Start today, and log yesterday if you practiced.',
      logYesterday: "Log yesterday's practices",
      didntPractice: "I didn't practice yesterday",
    },
    minutePicker: {
      titleToday: 'How long did you practice?',
      titleYesterday: 'How long did you practice yesterday?',
    },
  },
  setup: {
    header: {
      title: 'Add Practices',
      subtitle: {
        fromTracker: 'Select practices you currently do',
      },
    },
    section: {
      common: 'Commonly Practiced',
      other: 'Other Practices',
    },
    action: {
      add: 'Add',
      remove: 'Remove',
    },
    chip: {
      once: '1X',
      twice: '2X',
    },
  },
  progress: {
    legend: {
      less: 'less',
      more: 'more',
    },
  },
} as const;
