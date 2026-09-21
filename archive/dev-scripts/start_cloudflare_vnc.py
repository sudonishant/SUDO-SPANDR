import subprocess, time, re, sys, os

env = dict(os.environ)
env['GODEBUG'] = 'netdns=go'

cmd = ['/tmp/cloudflared', '--edge-ip-version', '4', 'tunnel', '--url', 'http://127.0.0.1:7860']
proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)

url = None
for _ in range(40):
    line = proc.stdout.readline()
    if not line:
        break
    print(line.strip())
    m = re.search(r'https://[a-zA-Z0-9.-]+\.trycloudflare\.com', line)
    if m:
        raw_url = m.group(0)
        url = f"{raw_url}/vnc.html?autoconnect=true&password=cybersqu&resize=remote&quality=8&compression=0&reconnect=true"
        with open('/tmp/cf_url.txt', 'w') as f:
            f.write(url)
        print('\n' + '='*68)
        print('🌟 LIVE CLOUDFLARE PUBLIC NOVNC URL (100% WEBSOCKET SUPPORT):')
        print(url)
        print('='*68 + '\n')
        break

proc.wait()
