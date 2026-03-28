# 🚴 BikeComputer

A React Native frontend for an ESP32-based bicycle computer. Communicates with the ESP32 over Bluetooth Low Energy (BLE), providing real-time speed measurement, session recording, GPS route tracking, and ride history.

---

## Screens

| Screen | Description |
|---|---|
| **Scan** | Scan for BLE devices and connect |
| **Dashboard** | Current speed, clock, session controls |
| **Session** | F1-style speed chart, detailed stats, landscape mode |
| **History** | Saved sessions list, speed graph with touch interaction, GPS route map |
| **Settings** | Wheel size configuration, send to ESP32 |
| **Sensor Test** | Sensor placement assistant: live signal, signal quality, pulse history |

---

## Tech Stack

- **React Native** 0.74 (TypeScript)
- **react-native-ble-plx** – BLE communication
- **react-native-maps** – GPS route display
- **@react-native-community/geolocation** – GPS coordinate collection
- **victory-native** – interactive speed chart
- **zustand** – global state management (session data)
- **@react-native-async-storage/async-storage** – local session database
- **react-native-quick-base64** – BLE data decoding
- **@react-navigation/native-stack** – screen navigation

---

## Installation

### 1. Install dependencies

```bash
npm install
cd ios && pod install && cd ..   # iOS only
```

### 2. Android permissions

Add to `android/app/src/main/AndroidManifest.xml` inside the `<manifest>` tag:

```xml
<!-- Bluetooth -->
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30"/>
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30"/>
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"/>
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>

<!-- Location (required for BLE scanning and GPS) -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
```

To enable screen rotation, remove this line from the `<activity>` tag (if present):
```xml
android:screenOrientation="portrait"
```

For the map to work, add your Google Maps API key inside `<application>`:
```xml
<meta-data
  android:name="com.google.android.geo.API_KEY"
  android:value="YOUR_API_KEY_HERE"/>
```

Get a free API key at [Google Cloud Console](https://console.cloud.google.com) — enable **Maps SDK for Android**.

### 3. iOS permissions

Add to `ios/<AppName>/Info.plist`:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>The app uses Bluetooth to connect to the ESP32 bike computer.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>The app uses GPS to record your route.</string>
<key>NSLocationAlwaysUsageDescription</key>
<string>The app uses GPS to record your route while cycling.</string>
```

### 4. Run

```bash
# Android
npx react-native run-android

# iOS
npx react-native run-ios
```

> ⚠️ BLE and GPS require a **physical device**. Emulators do not support real Bluetooth or GPS.

---

## ESP32 BLE Configuration

### UUIDs

```cpp
#define SERVICE_UUID        "12345678-1234-1234-1234-1234567890ab"
#define NOTIFY_CHAR_UUID    "abcdefab-1234-1234-1234-abcdefabcdef"  // ESP32 → App
#define WRITE_CHAR_UUID     "abcdefab-1234-1234-1234-abcdefabcdf0"  // App → ESP32
```

### Data format (NOTIFY)

The ESP32 sends data as a CSV string:

```
<speed km/h>,<distance km>,<pulse count>
```

Example: `23.4,1.23,596`

### Receiving wheel circumference (WRITE)

The app sends the wheel circumference as a plain string in meters:

```
2.1900
```

On the ESP32 side, read it in `WriteCallback` using `pChar->getValue().c_str()` then `.toFloat()`.

### Recommended ESP32 loop logic

```cpp
// Interrupt-based sensor handling
void IRAM_ATTR onPulse() {
  unsigned long now = millis();
  if (now - lastPulseTime > 50) {  // 50ms debounce
    newPulse = true;
    lastPulseTime = now;
  }
}

// Speed calculation in loop
if (newPulse) {
  newPulse = false;
  totalPulses++;

  float deltaS = (lastPulseTime - prevPulseTime) / 1000.0;
  float speedKmh = (wheelCircumference / deltaS) * 3.6;
  prevPulseTime = lastPulseTime;

  float distKm = (totalPulses * wheelCircumference) / 1000.0;

  // Send CSV over BLE notify
  String msg = String(speedKmh, 1) + "," + String(distKm, 2) + "," + String(totalPulses);
  pNotifyChar->setValue(msg.c_str());
  pNotifyChar->notify();
}

// Send zero speed if no pulse for 3 seconds
if (prevPulseTime > 0 && (millis() - lastPulseTime) > 3000) {
  prevPulseTime = 0;
  float distKm = (totalPulses * wheelCircumference) / 1000.0;
  String msg = "0.0," + String(distKm, 2) + "," + String(totalPulses);
  pNotifyChar->setValue(msg.c_str());
  pNotifyChar->notify();
}
```

---

## Project Structure

```
BikeComputer/
├── App.tsx                          # Navigation setup, route types
├── src/
│   ├── db/
│   │   └── sessionDB.ts             # AsyncStorage CRUD operations
│   ├── store/
│   │   └── sessionStore.ts          # Zustand state + GPS logic
│   └── screens/
│       ├── ScanScreen.tsx           # BLE device scanner
│       ├── DashboardScreen.tsx      # Main screen
│       ├── SessionScreen.tsx        # Live session detail view
│       ├── HistoryScreen.tsx        # Past sessions + map
│       ├── SettingsScreen.tsx       # Wheel size configuration
│       └── SensorTestScreen.tsx     # Sensor calibration helper
└── package.json
```

---

## Data Flow

```
ESP32 sensor
    │  interrupt (wheel rotation)
    ▼
ESP32 speed calculation
    │  BLE Notify: "23.4,1.23,596"
    ▼
sessionStore.onSpeedData()
    │  session-relative distance = abs - offset
    ▼
sessionStore.tick()  (every 1 second)
    │  records SessionPoint { t, spd }
    ▼
Geolocation.watchPosition()
    │  records GpsPoint { lat, lng, t }  (every ≥5m movement)
    ▼
stopSession() → SessionDB.save()
    │  persisted to AsyncStorage
    ▼
HistoryScreen  →  speed chart + route map
```

---

## Wheel Circumference Reference

| Size | Circumference |
|---|---|
| 20" | 1.59 m |
| 24" | 1.91 m |
| 26" | 2.07 m |
| **27.5"** | **2.19 m** ← default |
| 28" / 700c | 2.20 m |
| 29" | 2.29 m |

---

## Known Limitations

- GPS records a point only after at least 5 metres of movement to save battery
- The live speed chart stores a maximum of 5 minutes of data (300 points); older points are dropped
- The BLE Write feature (sending wheel circumference) requires the WRITE characteristic to be implemented on the ESP32 side
- Automatic reconnection attempts up to 3 times with a 2-second delay before showing a disconnect alert