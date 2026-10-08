"""Execute production receiver NVS save/load, including six-role migration."""
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
source = (root / 'FlightCore_Firmware/FlightSetup.h').read_text()

def function(name):
    start = source.index('void ' + name + '(')
    brace = source.index('{', start)
    depth, end = 1, brace + 1
    while depth:
        depth += (source[end] == '{') - (source[end] == '}')
        end += 1
    return source[start:end]

prefix = r'''
#include <cassert>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <vector>
#include "FlightSetupPolicy.h"
struct Preferences {
 uint32_t schema=0;std::vector<uint8_t> rx;bool yaw=false;uint8_t layout=0,input=0;
 void begin(const char*,bool){}void end(){}
 uint32_t getUInt(const char*,uint32_t){return schema;}
 size_t getBytesLength(const char*){return rx.size();}
 size_t getBytes(const char*,void* dst,size_t size){assert(size==rx.size());std::memcpy(dst,rx.data(),size);return size;}
 bool getBool(const char*,bool){return yaw;}
 uint8_t getUChar(const char* key,uint8_t){return !std::strcmp(key,"layout")?layout:input;}
 void putUInt(const char*,uint32_t value){schema=value;}
 void putBytes(const char*,const void* data,size_t size){auto p=static_cast<const uint8_t*>(data);rx.assign(p,p+size);}
 void putBool(const char*,bool value){yaw=value;}
 void putUChar(const char* key,uint8_t value){if(!std::strcmp(key,"layout"))layout=value;else input=value;}
}prefs;
FlightSetupPolicy::ReceiverSetup receiverSetup;
bool ppmArmLeft=false;uint8_t setupAirframe=0,setupInput=0,rcPreference=0;
'''
checks = r'''
int main(){
 struct Legacy{uint16_t minimum[6],centre[6],maximum[6];uint8_t channel[6];bool calibrated;} old={};
 for(int i=0;i<6;i++){old.minimum[i]=1000;old.centre[i]=1500;old.maximum[i]=2000;old.channel[i]=i;}old.minimum[0]=920;old.centre[0]=1480;old.maximum[0]=2080;old.channel[0]=8;old.calibrated=true;
 prefs.schema=1;prefs.putBytes("rx",&old,sizeof(old));prefs.yaw=true;prefs.layout=1;prefs.input=2;loadFcSetup();
 assert(receiverSetup.calibrated&&receiverSetup.channel[0]==8&&receiverSetup.minimum[0]==920&&receiverSetup.centre[0]==1480&&receiverSetup.maximum[0]==2080);
 assert(receiverSetup.channel[6]==255&&receiverSetup.channel[7]==255&&receiverSetup.txMode==2&&ppmArmLeft&&setupAirframe==1&&setupInput==2&&rcPreference==2);
 for(int i=4;i<8;i++)receiverSetup.channel[i]=255;receiverSetup.txMode=4;saveFcSetup();assert(prefs.schema==2&&prefs.rx.size()==sizeof(receiverSetup));receiverSetup={};loadFcSetup();assert(receiverSetup.calibrated&&receiverSetup.txMode==4&&receiverSetup.channel[4]==255);
 prefs.rx.pop_back();receiverSetup={};loadFcSetup();assert(!receiverSetup.calibrated&&receiverSetup.txMode==2); // wrong-sized NVS cannot mark calibration valid
 receiverSetup.calibrated=true;receiverSetup.txMode=0;prefs.putBytes("rx",&receiverSetup,sizeof(receiverSetup));receiverSetup={};loadFcSetup();assert(!receiverSetup.calibrated&&receiverSetup.txMode==2); // invalid schema-2 data rejected
 old.channel[1]=old.channel[0];prefs.schema=1;prefs.putBytes("rx",&old,sizeof(old));receiverSetup={};loadFcSetup();assert(!receiverSetup.calibrated);
 std::cout<<"PASS: production receiver NVS six-role migration, eight-role round trip, optional channels, mode persistence and corrupt/invalid calibration rejection\n";
}
'''
with tempfile.TemporaryDirectory() as directory:
    path = Path(directory)
    (path / 'storage.cpp').write_text(prefix + function('saveFcSetup') + function('loadFcSetup') + checks)
    subprocess.run(['g++', '-std=c++17', '-I', str(root / 'FlightCore_Firmware'), str(path / 'storage.cpp'), '-o', str(path / 'storage')], check=True)
    subprocess.run([str(path / 'storage')], check=True)
