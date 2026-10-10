import type { WidgetServerProps } from 'payload'

export default async function UserStatsWidget({ req }: WidgetServerProps) {
  const { payload, user } = req

  // Fetch data server-side

  return (
    <div className="card">
      <h1>Salut {user?.name?.split(' ')[0]}!</h1>
      <p>{user?.role}</p>
    </div>
  )
}