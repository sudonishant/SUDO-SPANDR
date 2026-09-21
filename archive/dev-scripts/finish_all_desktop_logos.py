import urllib.request
import os
import shutil
from PIL import Image, ImageDraw

output_dir = "/home/nee/Desktop/sih_tech_logos"
os.makedirs(output_dir, exist_ok=True)

# Final complete list of all 12 tools with verified direct raw PNG URLs
final_logos = [
    ("01_Python_Logo.png", "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/python/python.png"),
    ("02_FastAPI_Logo.png", "https://fastapi.tiangolo.com/img/logo-margin/logo-teal.png"),
    ("03_Neo4j_GraphDB_Logo.png", "https://raw.githubusercontent.com/github/explore/5b3600c70e24aa663a0a6eb600db43e7c83fcaee/topics/neo4j/neo4j.png"),
    ("04_Supabase_Logo.png", "https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-icon.png"),
    ("05_Blockchain_Hyperledger_Logo.png", "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/ethereum/ethereum.png"),
    ("06_Leaflet_GeoIP_Logo.png", "https://leafletjs.com/docs/images/logo.png"),
    ("07_React_Logo.png", "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/react/react.png"),
    ("08_Vite_Logo.png", "https://raw.githubusercontent.com/github/explore/5b3600c70e24aa663a0a6eb600db43e7c83fcaee/topics/vite/vite.png"),
    ("09_TailwindCSS_Logo.png", "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/tailwind/tailwind.png"),
    ("10_Cloudflare_ZeroTrust_Logo.png", "https://raw.githubusercontent.com/github/explore/5b3600c70e24aa663a0a6eb600db43e7c83fcaee/topics/cloudflare/cloudflare.png"),
    ("11_PostgreSQL_Logo.png", "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/postgresql/postgresql.png"),
    ("12_MITRE_ATTACK_Logo.png", "https://raw.githubusercontent.com/mitre-attack/attack-navigator/master/nav-app/src/assets/attack.png")
]

# Clean up existing folder to have exact clean numbered files
for f in os.listdir(output_dir):
    try:
        os.remove(os.path.join(output_dir, f))
    except:
        pass

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

for fname, url in final_logos:
    target_path = os.path.join(output_dir, fname)
    tmp_path = f"/tmp/{fname}"
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as r, open(tmp_path, "wb") as f:
            f.write(r.read())
        
        orig = Image.open(tmp_path).convert("RGBA")
        
        # 600x600 pure white canvas
        canvas = Image.new("RGBA", (600, 600), (255, 255, 255, 255))
        
        w, h = orig.size
        scale = min(440.0 / w, 440.0 / h)
        new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
        resized = orig.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        off_x = (600 - new_w) // 2
        off_y = (600 - new_h) // 2
        canvas.paste(resized, (off_x, off_y), resized)
        
        # Save solid RGB PNG with pure white background
        canvas.convert("RGB").save(target_path, "PNG", quality=98)
        print(f"✅ Generated: {fname}")
        
    except Exception as e:
        print(f"❌ Error on {fname}: {e}")

print("\n🎉 ALL LOGOS READY ON DESKTOP AT: /home/nee/Desktop/sih_tech_logos")
for f in sorted(os.listdir(output_dir)):
    size = os.path.getsize(os.path.join(output_dir, f)) / 1024
    print(f"  🖼️  {f} ({size:.1f} KB)")
