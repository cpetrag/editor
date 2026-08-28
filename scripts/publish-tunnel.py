from pathlib import Path

config = Path.home() / ".cloudflared" / "config.yml"
text = config.read_text(encoding="utf-8")
hostname = "editor.macmini-capture.cc"
rule = (
    f"  - hostname: {hostname}\n"
    "    service: http://localhost:4013\n"
)
if hostname in text:
    print("already-present")
else:
    needle = "  - service: http_status:404"
    if needle not in text:
        raise SystemExit("catch-all not found in cloudflared config")
    config.write_text(text.replace(needle, rule + needle, 1), encoding="utf-8")
    print("inserted")

print(config.read_text(encoding="utf-8"))
