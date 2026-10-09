import BulkImportExportBeforeListClient from '../components/BulkImportExportBeforeListClient'

export function BulkImportExportBeforeList(props: { endpointBase?: string }) {
  return <BulkImportExportBeforeListClient endpointBase={props.endpointBase} />
}
