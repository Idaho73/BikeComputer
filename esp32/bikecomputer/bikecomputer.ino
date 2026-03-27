#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>

#define SERVICE_UUID        "12345678-1234-1234-1234-1234567890ab"
#define NOTIFY_CHAR_UUID    "abcdefab-1234-1234-1234-abcdefabcdef"
#define WRITE_CHAR_UUID     "abcdefab-1234-1234-1234-abcdefabcdf0"
#define SENSOR_PIN 27
#define SPEED_TIMEOUT_MS 1500

BLECharacteristic *pNotifyChar;
BLECharacteristic *pWriteChar;
bool deviceConnected = false;

float wheelCircumference = 2.07; // default, app felülírja
volatile unsigned long lastPulseTime = 0;
volatile bool newPulse = false;
unsigned long totalPulses = 0;

// Write callback: app elküldi a kerékkerületet
class WriteCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pChar) override {
    String value = pChar->getValue().c_str();
    float newCirc = value.toFloat();
    if (newCirc > 0.5 && newCirc < 4.0) { // sanity check
      wheelCircumference = newCirc;
      Serial.println("Új kerékkerület: " + String(wheelCircumference));
    }
  }
};

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) override {
    deviceConnected = true;
  }
  void onDisconnect(BLEServer* pServer) override {
    deviceConnected = false;
    BLEDevice::startAdvertising();
  }
};

void IRAM_ATTR onPulse() {
  unsigned long now = millis();
  if (now - lastPulseTime > 120) {
    newPulse = true;
    lastPulseTime = now;
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(SENSOR_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(SENSOR_PIN), onPulse, FALLING);

  BLEDevice::init("BikeTracker");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Notify karakterisztika (ESP → App)
  pNotifyChar = pService->createCharacteristic(
    NOTIFY_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pNotifyChar->addDescriptor(new BLE2902());

  // Write karakterisztika (App → ESP)
  pWriteChar = pService->createCharacteristic(
    WRITE_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  pWriteChar->setCallbacks(new WriteCallback());

  pService->start();
  BLEDevice::getAdvertising()->addServiceUUID(SERVICE_UUID);
  BLEDevice::getAdvertising()->start();
}

void loop() {
  static unsigned long prevPulseTime = 0;
  static unsigned long lastDebug = 0;

  // ← EZT ADD HOZZÁ: minden 2 másodpercben kiír valamit
  if (millis() - lastDebug > 2000) {
    lastDebug = millis();
    Serial.println("--- DEBUG ---");
    Serial.println("Csatlakozva: " + String(deviceConnected));
    Serial.println("Kerékkerület: " + String(wheelCircumference));
    Serial.println("Összes jel: " + String(totalPulses));
    Serial.println("Pin állapot: " + String(digitalRead(SENSOR_PIN)));
  }

  if (newPulse) {
    newPulse = false;
    totalPulses++;

    float speedKmh = 0;
    if (prevPulseTime > 0) {
      float deltaS = (lastPulseTime - prevPulseTime) / 1000.0;
      speedKmh = (wheelCircumference / deltaS) * 3.6;
    }
    prevPulseTime = lastPulseTime;

    float distanceKm = (totalPulses * wheelCircumference) / 1000.0;
    String msg = String(speedKmh, 1) + "," +
                String(distanceKm, 2) + "," +
                String(totalPulses);

    if (deviceConnected) {
      pNotifyChar->setValue(msg.c_str());
      pNotifyChar->notify();
    }
  }

  if (deviceConnected && prevPulseTime > 0 &&
      (millis() - lastPulseTime) > SPEED_TIMEOUT_MS) {
    prevPulseTime = 0;
    float distanceKm = (totalPulses * wheelCircumference) / 1000.0;
  String msg = String(0.0, 1) + "," +
               String(distanceKm, 2) + "," +
               String(totalPulses);
    pNotifyChar->setValue(msg.c_str());
    pNotifyChar->notify();
  }
}