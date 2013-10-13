#!/bin/sh
#
# pack for upload to extensions.gnome.org

today=$(date +"%Y%m%d")

zip TeaTime@oleid.mescharet.de-$today.zip *.md utils.js prefs.js extension.js install.sh *.svg metadata.json schemas/org.gnome.shell.extensions.teatime.gschema.xml schemas/gschemas.compiled
