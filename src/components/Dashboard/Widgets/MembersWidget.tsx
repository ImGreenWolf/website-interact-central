import type { WidgetServerProps } from 'payload'

export default async function UserStatsWidget({ req }: WidgetServerProps) {
  const { payload } = req

  // Fetch data server-side
  const ActiveUserCount = await payload.count({ collection: 'users', where: {role: {equals: 'Membru Activ'}} })
  const userCount = await payload.count({ collection: 'users', where: {role: {equals: 'Membru Activ'}} })


  return (
    <div className="card">
      <h3>Membri Activi</h3>
      <p style={{ fontSize: '32px', fontWeight: 'bold' }}>
        {ActiveUserCount.totalDocs}
      </p>
    </div>
  )
}