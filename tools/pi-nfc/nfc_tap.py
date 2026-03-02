#!/usr/bin/env python3
"""
MiraCulture NFC Tap — Raspberry Pi NFC tag emulator.

Broadcasts a URL via NFC so fans can tap their phone to open
mira-culture.com (or a specific event page). Works with PN532
and ACR122U NFC modules.

Usage:
    python3 nfc_tap.py                          # Homepage
    python3 nfc_tap.py --event abc-123           # Specific event
    python3 nfc_tap.py --url https://custom.url  # Custom URL
    python3 nfc_tap.py --qr                      # Also show QR in terminal

Hardware:
    - PN532 via I2C/SPI/UART or ACR122U via USB
    - Connect PN532 to Pi via I2C (SDA=GPIO2, SCL=GPIO3)
"""

import argparse
import json
import logging
import signal
import sys
import time
from datetime import datetime
from pathlib import Path

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

BASE_URL = "https://mira-culture.com"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_DIR / "nfc_tap.log"),
    ],
)
log = logging.getLogger("nfc-tap")

# Tap analytics log (one JSON line per tap)
TAP_LOG = LOG_DIR / "taps.jsonl"


def log_tap(url: str, device_info: str = "") -> None:
    """Append a tap event to the JSONL analytics log."""
    entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "url": url,
        "device": device_info,
    }
    with open(TAP_LOG, "a") as f:
        f.write(json.dumps(entry) + "\n")
    log.info("Tap logged — total taps: %d", sum(1 for _ in open(TAP_LOG)))


def build_url(args: argparse.Namespace) -> str:
    """Build the target URL from CLI args."""
    if args.url:
        return args.url
    if args.event:
        return f"{BASE_URL}/events/{args.event}"
    return BASE_URL


def show_qr(url: str) -> None:
    """Print a QR code in the terminal as a fallback visual."""
    try:
        import qrcode  # type: ignore
        qr = qrcode.QRCode(border=1)
        qr.add_data(url)
        qr.make(fit=True)
        qr.print_ascii(invert=True)
    except ImportError:
        log.warning("Install 'qrcode' for terminal QR: pip3 install qrcode")


# ---------------------------------------------------------------------------
# NFC backends — try nfcpy first, fall back to raw PN532 over I2C
# ---------------------------------------------------------------------------

def run_nfcpy(url: str) -> None:
    """Card emulation using nfcpy (works with PN532 + ACR122U)."""
    import nfc  # type: ignore
    import ndef  # type: ignore

    uri_record = ndef.UriRecord(url)
    ndef_message = b"".join(ndef.message_encoder([uri_record]))

    def on_startup(target):
        """Called when the tag target is activated."""
        target.ndef_data_init = ndef_message
        target.brty = "212F"
        return target

    def on_connect(tag):
        log.info("Phone connected — serving %s", url)
        log_tap(url)
        return True  # keep tag active

    def on_release(tag):
        log.info("Phone released")
        return True

    # Auto-detect NFC device: USB first, then serial
    with nfc.ContactlessFrontend("usb") as clf:
        log.info("NFC device found: %s", clf.device)
        log.info("Broadcasting: %s", url)
        log.info("Waiting for phone taps... (Ctrl+C to stop)")

        while True:
            try:
                clf.connect(
                    rdwr={
                        "on-connect": on_connect,
                        "on-release": on_release,
                    },
                    tag={
                        "on-startup": on_startup,
                        "on-connect": on_connect,
                        "on-release": on_release,
                    },
                )
            except KeyboardInterrupt:
                break
            except Exception as e:
                log.error("NFC error: %s — retrying in 2s", e)
                time.sleep(2)


def run_pn532_i2c(url: str) -> None:
    """Direct PN532 control over I2C using adafruit-circuitpython-pn532."""
    from board import SCL, SDA  # type: ignore
    import busio  # type: ignore
    from adafruit_pn532.i2c import PN532_I2C  # type: ignore

    i2c = busio.I2C(SCL, SDA)
    pn532 = PN532_I2C(i2c, debug=False)

    ic, ver, rev, support = pn532.firmware_version
    log.info("PN532 firmware: %d.%d.%d", ver, rev, support)

    # Build NDEF URI record
    # URI prefix 0x04 = "https://" so strip that from url
    uri = url.replace("https://", "").replace("http://", "")
    prefix = 0x04 if url.startswith("https://") else 0x03
    uri_bytes = bytes([prefix]) + uri.encode("ascii")

    # NDEF message: type=URI
    ndef_record = bytes([
        0xD1,                    # MB=1, ME=1, TNF=001 (well-known)
        0x01,                    # Type length = 1
        len(uri_bytes),          # Payload length
        0x55,                    # Type = 'U' (URI)
    ]) + uri_bytes

    # TLV wrapper for Type 2 tag
    ndef_tlv = bytes([0x03, len(ndef_record)]) + ndef_record + bytes([0xFE])

    # Configure as Type 2 Tag
    pn532.SAM_configuration()

    log.info("Broadcasting: %s", url)
    log.info("Waiting for phone taps... (Ctrl+C to stop)")

    while True:
        try:
            # Try to emulate a tag (listen for initiator)
            uid = pn532.listen_for_passive_target(timeout=1.0)
            if uid is not None:
                log.info("Phone detected — UID: %s", uid.hex())
                # Write NDEF to the exchange
                pn532.ntag2xx_write_block(4, ndef_tlv[:4])
                for i in range(4, len(ndef_tlv), 4):
                    block = i // 4 + 4
                    chunk = ndef_tlv[i:i+4].ljust(4, b"\x00")
                    pn532.ntag2xx_write_block(block, chunk)
                log_tap(url, uid.hex())
                time.sleep(1)  # debounce
        except KeyboardInterrupt:
            break
        except Exception as e:
            log.debug("Scan cycle: %s", e)
            time.sleep(0.3)


def run_tag_emulation(url: str) -> None:
    """Try nfcpy first, fall back to direct PN532 I2C."""
    try:
        import nfc  # type: ignore  # noqa: F401
        log.info("Using nfcpy backend")
        run_nfcpy(url)
        return
    except ImportError:
        log.info("nfcpy not found, trying adafruit-pn532...")
    except Exception as e:
        log.warning("nfcpy failed: %s — trying adafruit-pn532...", e)

    try:
        run_pn532_i2c(url)
        return
    except ImportError:
        log.error(
            "No NFC library found. Install one:\n"
            "  pip3 install nfcpy ndeflib        # for USB (ACR122U)\n"
            "  pip3 install adafruit-circuitpython-pn532  # for I2C (PN532 HAT)"
        )
        sys.exit(1)
    except Exception as e:
        log.error("PN532 I2C failed: %s", e)
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="MiraCulture NFC Tap — broadcast event URLs via NFC"
    )
    parser.add_argument(
        "--event", "-e",
        help="Event ID to link to (e.g. abc-123)",
    )
    parser.add_argument(
        "--url", "-u",
        help="Custom URL to broadcast (overrides --event)",
    )
    parser.add_argument(
        "--qr",
        action="store_true",
        help="Show QR code in terminal as visual backup",
    )
    parser.add_argument(
        "--stats",
        action="store_true",
        help="Show tap statistics and exit",
    )
    args = parser.parse_args()

    url = build_url(args)

    # Stats mode
    if args.stats:
        if not TAP_LOG.exists():
            print("No taps recorded yet.")
            return
        taps = [json.loads(line) for line in open(TAP_LOG)]
        print(f"Total taps: {len(taps)}")
        if taps:
            print(f"First tap: {taps[0]['timestamp']}")
            print(f"Last tap:  {taps[-1]['timestamp']}")
            urls = {}
            for t in taps:
                urls[t["url"]] = urls.get(t["url"], 0) + 1
            print("By URL:")
            for u, count in sorted(urls.items(), key=lambda x: -x[1]):
                print(f"  {count:>4}  {u}")
        return

    # Banner
    print()
    print("  ╔══════════════════════════════════════╗")
    print("  ║    MiraCulture NFC Tap               ║")
    print("  ╠══════════════════════════════════════╣")
    print(f"  ║  URL: {url:<32}║")
    print("  ╚══════════════════════════════════════╝")
    print()

    if args.qr:
        show_qr(url)

    # Handle clean shutdown
    def shutdown(sig, frame):
        print("\nShutting down...")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    run_tag_emulation(url)


if __name__ == "__main__":
    main()
