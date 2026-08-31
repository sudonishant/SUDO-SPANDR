import socket, qrcode, io

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '10.127.239.68'
    finally:
        s.close()
    return ip

ip = get_ip()
url = f"http://{ip}:8000"

print("\n" + "="*56)
print(f"🚀 PHONE / OTHER DEVICE CONNECTION LINK:")
print(f"👉  {url}")
print("="*56 + "\n")
print("📱 SCAN THIS QR CODE WITH YOUR PHONE CAMERA:\n")

qr = qrcode.QRCode()
qr.add_data(url)
f = io.StringIO()
qr.print_ascii(out=f, invert=True)
f.seek(0)
print(f.read())
print("="*56)
