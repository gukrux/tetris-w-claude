---
name: weather-cli
description: "Trigger: weather, clima, temperatura, humedad, lluvia. Obtener información del clima actual y predicción de lluvia para una ubicación usando Open-Meteo API con caché local."
license: Apache-2.0
metadata:
  author: ingcrux
  version: "1.0"
---

# Weather CLI Skill

## Activation Contract

Use this skill when you need to:
- Check current weather (temperature, humidity, rain forecast)
- Get weather data without requiring an API key
- Cache results locally to avoid repeated API calls
- Quickly retrieve weather for any location worldwide

## How to Use

### Via Claude Code

When you ask me to check the weather, I will:
1. Use the `weather.sh` script to fetch data from Open-Meteo
2. Parse the JSON response for temperature, humidity, and rain probability
3. Display results in a readable format (San Salvador, El Salvador by default)
4. Cache the response locally (valid for 1 hour)

### Manually via CLI

**Default (San Salvador, El Salvador):**
```bash
.claude/skills/weather-cli/weather.sh
```

**Other locations:**
```bash
.claude/skills/weather-cli/weather.sh "New York"
.claude/skills/weather-cli/weather.sh "Tokyo"
.claude/skills/weather-cli/weather.sh "Buenos Aires"
```

## Data Fetched

- **Temperature**: Current temperature in °C
- **Humidity**: Current humidity percentage
- **Rain Probability**: 24-hour rain forecast probability
- **Weather Description**: Current conditions (clear, cloudy, rainy, etc.)
- **Wind Speed**: Current wind speed in km/h

## Caching Behavior

- Cache stored in: `.claude/cache/weather/`
- Cache validity: 1 hour per location
- Automatic invalidation after expiry
- Manual cache clear: `rm -rf .claude/cache/weather/`

## API Details

- **Source**: Open-Meteo (free, no API key required)
- **Rate Limit**: 10,000 free API calls per day
- **Geocoding**: Automatic via location name
- **Coverage**: Worldwide

## Example Output

```
Weather for Buenos Aires:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Temperature: 22°C
 Humidity: 65%
 Condition: Partly Cloudy
 Wind: 12 km/h
 Rain Probability: 15%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Technical Notes

- Uses `curl` to fetch data from Open-Meteo API
- Uses `python3` for JSON parsing (no external dependencies like jq)
- Cross-platform compatible (bash)
- No external API keys or credentials needed
- Default location: San Salvador, El Salvador
