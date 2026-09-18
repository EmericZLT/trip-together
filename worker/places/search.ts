import { z } from "zod";
import { placeSchema } from "../../shared/places";
import { HttpError, json } from "../http";
import { rateLimit } from "../security/rate-limit";
const responseSchema = z.object({
  results: z.array(
    z.object({
      place_id: z.string(),
      name: z.string().optional(),
      address_line1: z.string().optional(),
      formatted: z.string(),
      lat: z.number(),
      lon: z.number(),
      country_code: z.string().optional(),
    }),
  ),
});
export async function searchPlaces(
  request: Request,
  env: Env,
  memberId: string,
) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 200)
    throw new HttpError(400, "请输入 2 至 200 个字的地点名称");
  if (!env.GEOAPIFY_API_KEY)
    throw new HttpError(503, "地点搜索暂不可用，可以稍后添加地点");
  await rateLimit(request, env, "place-search", 120, memberId);
  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.search = new URLSearchParams({
    text: query,
    lang: "zh",
    limit: "6",
    format: "json",
    bias: "countrycode:none",
    apiKey: env.GEOAPIFY_API_KEY,
  }).toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("provider unavailable");
    const data = responseSchema.parse(await response.json());
    const places = data.results.flatMap((result) => {
      const parsed = placeSchema.safeParse({
        id: result.place_id,
        name: (result.name || result.address_line1 || result.formatted).slice(
          0,
          150,
        ),
        address: result.formatted.slice(0, 500),
        latitude: result.lat,
        longitude: result.lon,
        countryCode: result.country_code ?? "",
        provider: "geoapify",
      });
      return parsed.success ? [parsed.data] : [];
    });
    return json({ places });
  } catch {
    throw new HttpError(
      503,
      "地点搜索暂时失败，请稍后重试，或尝试城市名和当地名称",
    );
  }
}
