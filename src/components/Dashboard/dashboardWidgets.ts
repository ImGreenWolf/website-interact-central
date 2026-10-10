const dashboardWidgets = [
  {
    slug: 'member-presence-statistics',
    label: 'Statistici prezență membri',
    Component: '@/components/Dashboard/Widgets/MemberPresenceStatisticsWidget',
  },
  {
    slug: 'member-presence-graph',
    label: 'Grafic prezență membri',
    Component: '@/components/Dashboard/Widgets/MemberPresenceGraphWidget',
  },
  {
    slug: 'meetings-management',
    label: 'Administrare întâlniri',
    Component: '@/components/Dashboard/Widgets/MeetingsManagementWidget',
  },
  {
    slug: 'last-meeting-statistic',
    label: 'Statistica ultimei întâlniri',
    Component: '@/components/Dashboard/Widgets/LastMeetingStatisticWidget',
  },
  {
    slug: 'intro-widget',
    label: 'Introducere',
    Component: '@/components/Dashboard/Widgets/IntroWidget',
  },
]

export default dashboardWidgets
