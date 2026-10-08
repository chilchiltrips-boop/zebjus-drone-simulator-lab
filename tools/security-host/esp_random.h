#pragma once
#include <stddef.h>
#include <sys/random.h>
#include <stdlib.h>
static inline void esp_fill_random(void* a,size_t n){if(getrandom(a,n,0)!=(long)n)abort();}
