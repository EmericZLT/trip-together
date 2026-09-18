import { HttpError } from "../http";
export type Trip = {
  destinations?: string;
  id: string;
  title: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  timezone: string;
  home_timezone: string;
  currency: string;
  home_currency: string;
  version: number;
};
export async function requireTrip(
  env: Env,
  memberId: string,
  tripId: string,
): Promise<Trip> {
  const trip = await env.DB.prepare(
    "SELECT t.* FROM trips t JOIN trip_members m ON m.trip_id=t.id WHERE t.id=? AND m.member_id=?",
  )
    .bind(tripId, memberId)
    .first<Trip>();
  if (!trip) throw new HttpError(404, "行程不存在或没有访问权限");
  return trip;
}
export function requireOwner(trip: Trip, memberId: string) {
  if (trip.owner_id !== memberId)
    throw new HttpError(403, "只有创建者可以管理此操作");
}
export async function requireDocument(
  env: Env,
  id: string,
  tripId: string,
  memberId: string,
  shared = false,
) {
  const doc = await env.DB.prepare(
    "SELECT id FROM documents WHERE id=? AND trip_id=? AND (owner_id IS NULL OR (?=0 AND owner_id=?))",
  )
    .bind(id, tripId, Number(shared), memberId)
    .first();
  if (!doc) throw new HttpError(400, "资料不存在或不属于当前行程");
}
