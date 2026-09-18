import { z } from "zod";
import { placeSchema, type Place } from "../../shared/places";
const resultSchema = z.object({
  place_id: z.string(),
  name: z.string().nullish(),
  address_line1: z.string().nullish(),
  formatted: z.string(),
  lat: z.number(),
  lon: z.number(),
  country_code: z.string().nullish(),
});
const responseSchema = z.object({ results: z.array(z.unknown()) });
function parsePlaces(data: unknown): Place[] {
  return responseSchema.parse(data).results.flatMap((result) => {
    const parsed = resultSchema.safeParse(result);
    if (!parsed.success) return [];
    const v = parsed.data;
    const place = placeSchema.safeParse({
      id: v.place_id,
      name: (v.name || v.address_line1 || v.formatted).slice(0, 150),
      address: v.formatted.slice(0, 500),
      latitude: v.lat,
      longitude: v.lon,
      countryCode: v.country_code ?? "",
      provider: "geoapify",
    });
    return place.success ? [place.data] : [];
  });
}
export async function findPlaces(
  query: string,
  key: string,
  fetcher: (url: URL, init: RequestInit) => Promise<Response> = (url, init) =>
    fetch(url, init),
) {
  // Both attempts share one deadline; provider errors must not become empty results.
  const signal = AbortSignal.timeout(8000);
  for (const city of [false, true]) {
    const url = new URL("https://api.geoapify.com/v1/geocode/search");
    url.search = new URLSearchParams({
      ...(city ? { city: query, type: "city" } : { text: query }),
      lang: "zh",
      limit: "6",
      format: "json",
      bias: "countrycode:none",
      apiKey: key,
    }).toString();
    const response = await fetcher(url, { signal });
    if (!response.ok) throw new Error("Place provider unavailable");
    const places = parsePlaces(await response.json());
    if (places.length) return places;
  }
  return [];
}
