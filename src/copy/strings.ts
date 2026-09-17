export const COPY = {
  tracker: {
    header: {
      title: 'My Practices',
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
