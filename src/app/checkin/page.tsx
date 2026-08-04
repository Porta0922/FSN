import CheckinClient from "./CheckinClient"

export default async function CheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  const { t } = await searchParams
  return <CheckinClient token={t ?? ""} />
}
