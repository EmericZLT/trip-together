import { z } from "zod";
export const placeSchema = z.object({
  id: z.string().min(1).max(1000),
  name: z.string().min(1).max(150),
  address: z.string().max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  countryCode: z.string().max(3).default(""),
  provider: z.literal("geoapify"),
});
export type Place = z.infer<typeof placeSchema>;
export function mapLink(place: Place) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set(
    "destination",
    `${place.latitude},${place.longitude}`,
  );
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}
export function mapSearchLink(query: string) {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", query);
  return url.toString();
}
export function mapCopyText(input: {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}) {
  const lines = [input.name?.trim(), input.address?.trim()].filter(
    (value): value is string => Boolean(value),
  );
  if (
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude)
  ) {
    lines.push(`${input.latitude}, ${input.longitude}`);
  }
  return [...new Set(lines)].join("\n");
}
