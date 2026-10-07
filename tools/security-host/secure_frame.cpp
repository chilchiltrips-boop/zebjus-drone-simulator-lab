#include <iostream>
#include <string>
#include <vector>
#include <cassert>
#include "../../FlightCore_Firmware/SecureFrames.h"
std::vector<uint8_t> parse(const char* text){std::string s(text);std::vector<uint8_t> out;for(size_t i=0;i<s.size();i+=2)out.push_back(std::stoul(s.substr(i,2),nullptr,16));return out;}
int main(int argc,char** argv){
 assert(argc==6);auto key=parse(argv[2]),aad=parse(argv[4]),data=parse(argv[5]);assert(key.size()==32);uint64_t seq=std::stoull(argv[3]);std::vector<uint8_t> out(data.size()+16);
 bool ok=std::string(argv[1])=="seal"?ZfcSecure::seal(key.data(),seq,aad.data(),aad.size(),data.data(),data.size(),out.data()):ZfcSecure::open(key.data(),seq,aad.data(),aad.size(),data.data(),data.size(),out.data());
 if(!ok){std::cout<<"DENIED";return 0;}size_t size=std::string(argv[1])=="seal"?data.size()+16:data.size()-16;
 const char* hex="0123456789abcdef";for(size_t i=0;i<size;i++)std::cout<<hex[out[i]>>4]<<hex[out[i]&15];
 ZfcSecure::ReplayWindow window;assert(window.allowed(70));window.accept(70);assert(!window.allowed(70)&&!window.allowed(6)&&window.allowed(7));window.accept(7);assert(!window.allowed(7)&&window.allowed(69));window.accept(69);assert(!window.allowed(69));
}
