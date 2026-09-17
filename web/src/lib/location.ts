export type ClockZone = "home" | "destination";
export type CurrentLocation = { name: string };

export async function lookupLocation(
  coords: GeolocationCoordinates,
  signal?: AbortSignal,
): Promise<CurrentLocation> {
  if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude))
    throw new Error("无法获取有效坐标");
  const url = new URL(
    "https://api.bigdatacloud.net/data/reverse-geocode-client",
  );
  url.searchParams.set("localityLanguage", "zh");
  url.searchParams.set("latitude", String(coords.latitude));
  url.searchParams.set("longitude", String(coords.longitude));
  const response = await fetch(url, {
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error("位置查询暂时不可用");
  const value = await response.json();
  const city = value.city || value.locality || value.principalSubdivision;
  // Reject provider-side IP fallback, even when device coordinates were supplied.
  if (
    value.lookupSource !== "coordinates" ||
    typeof city !== "string" ||
    !city.trim()
  )
    throw new Error("未能根据设备坐标识别位置");
  return {
    name: city,
  };
}

export function currentCoordinates(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("浏览器不支持定位"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      reject,
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      },
    );
  });
}
