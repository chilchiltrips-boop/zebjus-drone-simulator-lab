#pragma once
#include <Arduino.h>

// Declared in a header so Arduino auto-generated function prototypes can
// reference ImuSample safely before the .ino body is parsed.
struct ImuSample{
  uint8_t address=0,whoAmI=0,kind=0;
  int16_t rawGx=0,rawGy=0,rawGz=0,rawAx=0,rawAy=0,rawAz=0;
  float gx=0,gy=0,gz=0,ax=0,ay=0,az=0;
  uint32_t sampledAt=0;
};
