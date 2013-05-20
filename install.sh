NAME="TeaTime@oleid.mescharet.de"
INST_DIR="$HOME/.local/share/gnome-shell-extensions/$NAME"

echo "Installing icon"
sudo cp utilities-teatime.svg /usr/share/icons/hicolor/scalable/apps/
sudo gtk-update-icon-cache /usr/share/icons/hicolor/

echo "Installing extension"
mkdir -p "$INST_DIR"

cp *.js *.json  "$INST_DIR"
