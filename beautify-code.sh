#!/bin/sh

SRC_DIR=$(dirname $0)
echo $SRC_DIR

for fn in "${SRC_DIR}"/src/*.js ; do
	js-beautify --replace \
		--indent-with-tabs \
		--end-with-newline \
		--jslint-happy \
		$fn
done
