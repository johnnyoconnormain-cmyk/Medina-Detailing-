import "server-only";

/**
 * Weather seam. Landscaping revenue is weather-bound, so the HUD has a panel for
 * it — but an invented forecast that tells a crew to skip a job would be worse
 * than no forecast. Until a key is present, `getForecast` returns null and the
 * panel says so plainly.
 */
export type DayForecast = {
  date: string; tempF: number; precipProbability: number; windMph: number;
  condition: "clear" | "cloudy" | "rain" | "storm" | "snow"; summary: string;
};

export interface WeatherProvider {
  readonly name: string;
  getForecast(where: { lat: number; lng: number }, days: number): Promise<DayForecast[] | null>;
}

class UnconfiguredWeather implements WeatherProvider {
  readonly name = "unconfigured";
  async getForecast() { return null; }
}

export function isWeatherAvailable(): boolean {
  return Boolean(process.env.WEATHER_API_KEY);
}

let weather: WeatherProvider | null = null;
export function getWeather(): WeatherProvider {
  if (!weather) weather = new UnconfiguredWeather();
  return weather;
}
