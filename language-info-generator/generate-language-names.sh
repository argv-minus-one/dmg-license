#!/bin/sh -e

cd "`dirname "$0"`"

if [ ! -e GetLanguageNames.class -o GetLanguageNames.class -ot GetLanguageNames.java ]; then
  javac -source 7 -target 7 GetLanguageNames.java
fi

cut -f 4 <"Languages.tsv" | sed 1d | tr '\n' '\0' | xargs -0 java -classpath . GetLanguageNames >"Language names.tsv"
