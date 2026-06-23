import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface WeatherData {
  current: {
    temp_c: number;
    condition: string;
    icon: string;
    humidity: number;
    wind_kph: number;
    precip_mm: number;
  };
  forecast: Array<{
    date: string;
    avgtemp_c: number;
    condition: string;
    icon: string;
    daily_chance_of_rain: number;
  }>;
}

export const getForecast = async (query: string): Promise<WeatherData> => {
  if (!env.WEATHER_API_KEY || env.WEATHER_API_KEY === 'AIza_your_gemini_api_key_here' || env.WEATHER_API_KEY.includes('your_')) {
    logger.warn('WEATHER_API_KEY not configured or is a placeholder. Returning mock weather data.');
    return getMockForecast(query);
  }

  try {
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${env.WEATHER_API_KEY}&q=${encodeURIComponent(query)}&days=3&aqi=no&alerts=no`;
    const response = await axios.get(url);
    const data = response.data;

    return {
      current: {
        temp_c: Math.round(data.current.temp_c),
        condition: data.current.condition.text,
        icon: data.current.condition.icon,
        humidity: data.current.humidity,
        wind_kph: data.current.wind_kph,
        precip_mm: data.current.precip_mm,
      },
      forecast: data.forecast.forecastday.map((d: any) => {
        const dateObj = new Date(d.date);
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
        return {
          date: dayName,
          avgtemp_c: Math.round(d.day.avgtemp_c),
          condition: d.day.condition.text,
          icon: d.day.condition.icon,
          daily_chance_of_rain: d.day.daily_chance_of_rain || d.day.daily_chance_of_showers || 0,
        };
      }),
    };
  } catch (error: any) {
    logger.error(`Error querying WeatherAPI for ${query}: ${error?.message || error}`);
    return getMockForecast(query);
  }
};

const getMockForecast = (query: string): WeatherData => {
  return {
    current: {
      temp_c: 26,
      condition: 'Sunny',
      icon: '//cdn.weatherapi.com/weather/64x64/day/113.png',
      humidity: 55,
      wind_kph: 15,
      precip_mm: 0,
    },
    forecast: [
      { date: 'Today', avgtemp_c: 26, condition: 'Sunny', icon: '//cdn.weatherapi.com/weather/64x64/day/113.png', daily_chance_of_rain: 10 },
      { date: 'Tomorrow', avgtemp_c: 24, condition: 'Partly Cloudy', icon: '//cdn.weatherapi.com/weather/64x64/day/116.png', daily_chance_of_rain: 20 },
      { date: 'Day after', avgtemp_c: 25, condition: 'Patchy Rain', icon: '//cdn.weatherapi.com/weather/64x64/day/176.png', daily_chance_of_rain: 50 },
    ],
  };
};
