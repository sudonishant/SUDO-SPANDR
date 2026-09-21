import urllib.request
import os
from PIL import Image

output_dir = "/home/nee/Desktop/sih_tech_logos"
os.makedirs(output_dir, exist_ok=True)

# Clean, authentic direct PNG links from unpkg / jsdelivr / official raw repos
logo_catalog = [
    ("01_Python.png", "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg", "https://raw.githubusercontent.com/devicons/devicon/master/icons/python/python-original.svg"),
    ("02_FastAPI.png", "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/fastapi/fastapi-original.svg", "https://fastapi.tiangolo.com/img/logo-margin/logo-teal.png"),
    ("03_Neo4j_GraphDB.png", "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/neo4j/neo4j-original.svg", "https://dist.neo4j.com/wp-content/uploads/20210423062553/neo4j-logo-2020-1.png"),
    ("04_Supabase.png", "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/supabase/supabase-original.svg", "https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-icon.png"),
    ("05_Blockchain_Hyperledger.png", "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/hyperledger/hyperledger-original.svg", "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/ethereum/ethereum.png"),
    ("06_Leaflet_GeoIP.png", "", "https://leafletjs.com/docs/images/logo.png"),
    ("07_React.png", "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg", "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/react/react.png"),
    ("08_Vite.png", "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vitejs/vitejs-original.svg", "https://vitejs.dev/logo-with-shadow.png"),
    ("09_TailwindCSS.png", "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg", "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/tailwind/tailwind.png"),
    ("10_Cloudflare_ZeroTrust.png", "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cloudflare/cloudflare-original.svg", "https://www.cloudflare.com/img/logo-cloudflare-dark.png"),
    ("11_PostgreSQL.png", "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg", "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/postgresql/postgresql.png"),
    ("12_MITRE_ATTACK.png", "", "https://attack.mitre.org/theme/images/mitre_attack_logo.png")
]

headers = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)'}

for fname, svg_url, png_url in logo_catalog:
    target_path = os.path.join(output_dir, fname)
    tmp_path = f"/tmp/{fname}"
    
    # Try direct PNG first
    downloaded = False
    for url in [png_url, svg_url]:
        if not url: continue
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=8) as r, open(tmp_path, "wb") as f:
                f.write(r.read())
            
            # Check if valid image
            img = Image.open(tmp_path).convert("RGBA")
            
            # Create high-res 600x600 pure white square
            card = Image.new("RGBA", (600, 600), (255, 255, 255, 255))
            
            w, h = img.size
            scale = min(440.0 / w, 440.0 / h)
            new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
            resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            
            off_x = (600 - new_w) // 2
            off_y = (600 - new_h) // 2
            card.paste(resized, (off_x, off_y), resized)
            
            # Save solid RGB PNG
            card.convert("RGB").save(target_path, "PNG", quality=98)
            print(f"✅ Success: {fname}")
            downloaded = True
            break
        except Exception as e:
            continue
            
    if not downloaded:
        print(f"⚠️ Could not fetch remote image for {fname}")

print("\n📁 Current files in Desktop folder /home/nee/Desktop/sih_tech_logos:")
for item in sorted(os.listdir(output_dir)):
    sz = os.path.getsize(os.path.join(output_dir, item)) / 1024
    print(f"   {item} ({sz:.1f} KB)")
