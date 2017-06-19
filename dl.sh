#!/bin/bash

mkdir -p css
for url in `cat list.txt`
do
    wget -P css ${url}
done