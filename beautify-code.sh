#!/bin/sh

SRC_DIR=$(dirname $0)
echo $SRC_DIR

for fn in "${SRC_DIR}"/src/*.js ; do
	js-beautify -t -n -r -j $fn
done
