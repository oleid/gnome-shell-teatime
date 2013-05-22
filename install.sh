NAME="TeaTime@oleid.mescharet.de"

if [ "$1" = "local" ] ; then
   INST_DIR="$HOME/.local/share/gnome-shell/extensions/$NAME"
   SUDO=""
else
   INST_DIR="/usr/share/gnome-shell/extensions/$NAME"
   SUDO="sudo"

   echo "Installing icon"
   $SUDO cp utilities-teatime.svg /usr/share/icons/hicolor/scalable/apps/
   $SUDO gtk-update-icon-cache /usr/share/icons/hicolor/
fi


echo "Installing extension"
glib-compile-schemas schemas
$SUDO mkdir -p "$INST_DIR"

$SUDO cp  -ax *.js *.json  schemas "$INST_DIR" 

if [ "$1" = "local" ]; then
    $SUDO cp *.svg  "$INST_DIR"
fi
