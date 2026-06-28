#!/bin/bash

LOCATION="${1:-San Salvador, El Salvador}"
CACHE_DIR="${HOME}/.claude/cache/weather"
CACHE_FILE="${CACHE_DIR}/${LOCATION// /_}.json"
CACHE_DURATION=3600  # 1 hour in seconds

# Ensure cache directory exists
mkdir -p "$CACHE_DIR"

# Helper function to extract JSON values (no jq needed)
extract_json() {
  python3 -c "import json, sys; data=json.load(sys.stdin); print($1)" 2>/dev/null || echo ""
}

# Check if cache exists and is fresh
if [[ -f "$CACHE_FILE" ]]; then
  CACHE_AGE=$(($(date +%s) - $(stat -f%m "$CACHE_FILE" 2>/dev/null || stat -c%Y "$CACHE_FILE" 2>/dev/null)))
  if [[ $CACHE_AGE -lt $CACHE_DURATION ]]; then
    echo "📦 Using cached data for $LOCATION (cached $(($CACHE_AGE / 60))m ago)"
    WEATHER_DATA=$(cat "$CACHE_FILE")
  else
    rm "$CACHE_FILE"
    WEATHER_DATA=""
  fi
else
  WEATHER_DATA=""
fi

# Fetch fresh data if cache is stale
if [[ -z "$WEATHER_DATA" ]]; then
  echo "🌐 Fetching weather for $LOCATION..."

  # Geocode the location (URL encode the location name)
  ENCODED_LOCATION=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$LOCATION'))")
  GEO_RESPONSE=$(curl -s "https://geocoding-api.open-meteo.com/v1/search?name=${ENCODED_LOCATION}&count=1&language=en&format=json")

  LATITUDE=$(echo "$GEO_RESPONSE" | extract_json "data['results'][0]['latitude'] if data.get('results') else None")
  LONGITUDE=$(echo "$GEO_RESPONSE" | extract_json "data['results'][0]['longitude'] if data.get('results') else None")
  LOCATION_NAME=$(echo "$GEO_RESPONSE" | extract_json "data['results'][0]['name'] if data.get('results') else None")

  if [[ -z "$LATITUDE" ]] || [[ "$LATITUDE" == "None" ]]; then
    echo "❌ Location not found: $LOCATION"
    exit 1
  fi

  # Fetch weather data
  WEATHER_RESPONSE=$(curl -s "https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto")

  # Store both responses for later parsing
  WEATHER_DATA="$WEATHER_RESPONSE"

  # Cache the result
  echo "$WEATHER_DATA" > "$CACHE_FILE"
fi

# Parse and display weather data using Python
TEMP=$(echo "$WEATHER_DATA" | python3 -c "import json, sys; data=json.load(sys.stdin); print(int(data['current'].get('temperature_2m', 0)))" 2>/dev/null || echo "N/A")
HUMIDITY=$(echo "$WEATHER_DATA" | python3 -c "import json, sys; data=json.load(sys.stdin); print(int(data['current'].get('relative_humidity_2m', 0)))" 2>/dev/null || echo "N/A")
WIND=$(echo "$WEATHER_DATA" | python3 -c "import json, sys; data=json.load(sys.stdin); print(round(data['current'].get('wind_speed_10m', 0), 1))" 2>/dev/null || echo "N/A")
WEATHER_CODE=$(echo "$WEATHER_DATA" | python3 -c "import json, sys; data=json.load(sys.stdin); print(int(data['current'].get('weather_code', 0)))" 2>/dev/null || echo "0")

# Get location name from cache filename or use default
LOCATION_NAME="${LOCATION}"

# Map weather codes to descriptions
case $WEATHER_CODE in
  0) CONDITION="Clear sky" ;;
  1|2) CONDITION="Partly cloudy" ;;
  3) CONDITION="Overcast" ;;
  45|48) CONDITION="Foggy" ;;
  51|53|55) CONDITION="Drizzle" ;;
  61|63|65) CONDITION="Rain" ;;
  71|73|75|77) CONDITION="Snow" ;;
  80|81|82) CONDITION="Rain showers" ;;
  85|86) CONDITION="Snow showers" ;;
  95|96|99) CONDITION="Thunderstorm" ;;
  *) CONDITION="Unknown" ;;
esac

# Display results
echo ""
echo "Weather for $LOCATION_NAME:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " 🌡️  Temperature: ${TEMP}°C"
echo " 💧 Humidity: ${HUMIDITY}%"
echo " 🌬️  Wind: ${WIND} km/h"
echo " ☁️  Condition: $CONDITION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
