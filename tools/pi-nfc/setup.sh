#!/bin/bash
# MiraCulture NFC Tap — Pi Setup Script
# Run: bash setup.sh

set -e

echo "=== MiraCulture NFC Tap Setup ==="
echo ""

# System deps
echo "[1/4] Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq python3-pip python3-venv libusb-1.0-0-dev i2c-tools

# Enable I2C (for PN532 HAT)
echo "[2/4] Enabling I2C..."
sudo raspi-config nonint do_i2c 0 2>/dev/null || echo "  (skipped — enable manually via raspi-config if using PN532 over I2C)"

# Python venv
echo "[3/4] Setting up Python environment..."
cd "$(dirname "$0")"
python3 -m venv .venv
source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet nfcpy ndeflib qrcode adafruit-circuitpython-pn532

# USB permissions for NFC readers (ACR122U, PN532 USB)
echo "[4/4] Setting USB permissions..."
sudo tee /etc/udev/rules.d/99-nfc.rules > /dev/null << 'UDEV'
# ACR122U
SUBSYSTEM=="usb", ATTRS{idVendor}=="072f", ATTRS{idProduct}=="2200", MODE="0666"
# PN532 USB
SUBSYSTEM=="usb", ATTRS{idVendor}=="04e6", MODE="0666"
UDEV
sudo udevadm control --reload-rules
sudo udevadm trigger

echo ""
echo "=== Setup complete ==="
echo ""
echo "Test NFC hardware:"
echo "  # I2C (PN532 HAT):"
echo "  sudo i2cdetect -y 1    # should show device at 0x24"
echo ""
echo "  # USB (ACR122U):"
echo "  lsusb | grep -i nfc"
echo ""
echo "Run the script:"
echo "  source .venv/bin/activate"
echo "  python3 nfc_tap.py                    # homepage"
echo "  python3 nfc_tap.py -e EVENT_ID        # specific event"
echo "  python3 nfc_tap.py --qr               # with QR fallback"
echo "  python3 nfc_tap.py --stats            # view tap analytics"
