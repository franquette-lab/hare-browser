cat << 'EOF' > ~/test-hare.sh
#!/bin/bash
set -e

echo "=== 0. Montage du disque virtuel 30 Go sur /home/liveuser si necessaire ==="
if ! mountpoint -q "$HOME"; then
    sudo mount /dev/sda "$HOME"
    sudo chown -R "$USER:$USER" "$HOME"
fi

echo "=== 1. Configuration du clavier francais (AZERTY) ==="
gsettings set org.gnome.desktop.input-sources sources "[('xkb', 'fr')]"

echo "=== 2. Verification de libfuse.so.2 ==="
if ! ldconfig -p | grep -q "libfuse.so.2"; then
    sudo dnf install -y fuse fuse-libs
fi

echo "=== 3. Arret de l'ancienne instance ==="
pkill -f Hare-Browser || true
sleep 1

echo "=== 4. Recherche et copie de l'AppImage ==="
LATEST_APPIMAGE=$(sudo sh -c 'ls -t /media/sf_Downloads/Hare-Browser-*-x86_64.AppImage 2>/dev/null | head -n 1')

if [ -z "$LATEST_APPIMAGE" ]; then
    echo "Erreur : Aucune AppImage trouvee dans /media/sf_Downloads/"
    exit 1
fi

mkdir -p "$HOME/Downloads"
DEST="$HOME/Downloads/$(basename "$LATEST_APPIMAGE")"
rm -f "$DEST"
sudo cp "$LATEST_APPIMAGE" "$DEST"
sudo chown "$USER:$USER" "$DEST"
chmod +x "$DEST"

echo "=== 5. Lancement de Hare Browser ==="
mkdir -p "$HOME/tmp"
TMPDIR="$HOME/tmp" "$DEST"
EOF

chmod +x ~/test-hare.sh
