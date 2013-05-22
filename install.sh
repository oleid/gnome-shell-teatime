NAME="TeaTime@oleid.mescharet.de"

if [ "$1" != "global" ] ; then
   INST_DIR="$HOME/.local/share/gnome-shell/extensions/$NAME"
   SUDO=""

   echo "Installing extension locally..."
else
   INST_DIR="/usr/share/gnome-shell/extensions/$NAME"
   SUDO="sudo"

   echo "Installing extension globally..."

   echo "Installing icon"
   $SUDO cp utilities-teatime.svg /usr/share/icons/hicolor/scalable/apps/
   $SUDO gtk-update-icon-cache /usr/share/icons/hicolor/
fi


echo "Installing extension"
$SUDO mkdir -p "$INST_DIR"

$SUDO cp  *.js *.json "$INST_DIR" 

if [ "$1" != "global" ]; then
    $SUDO cp -ax *.svg schemas  "$INST_DIR"
    glib-compile-schemas "$INST_DIR"/schemas
else 
    echo "Installing schema"
    $SUDO cp schemas/*.xml /usr/share/glib-2.0/schemas/ && \
    $SUDO glib-compile-schemas /usr/share/glib-2.0/schemas/ 2> /dev/null
fi
