import subprocess, time, re, sys

cmd = ['ssh', '-4', '-o', 'StrictHostKeyChecking=no', '-R', '80:127.0.0.1:8000', 'nokey@localhost.run']
proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

url = None
for line in iter(proc.stdout.readline, ''):
    sys.stdout.write(line)
    sys.stdout.flush()
    m = re.search(r'https://[a-zA-Z0-9.-]+\.lhr\.life', line)
    if m and not url:
        url = m.group(0)
        with open('/tmp/public_url.txt', 'w') as f:
            f.write(url)
        print('\n\n>>> ACTIVE PUBLIC URL:', url, '<<<\n\n', flush=True)

proc.wait()
