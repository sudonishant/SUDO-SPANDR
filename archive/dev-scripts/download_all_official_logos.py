import os
import urllib.request
import json
from PIL import Image

output_dir = "/home/nee/Desktop/sih_tech_logos"
os.makedirs(output_dir, exist_ok=True)

# 12 Verified Official High-Res PNG Logo URLs
verified_tools = [
    {
        "name": "Python",
        "filename": "1_Python_Logo.png",
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Python-logo-notext.svg/600px-Python-logo-notext.svg.png"
    },
    {
        "name": "FastAPI",
        "filename": "2_FastAPI_Logo.png",
        "url": "https://fastapi.tiangolo.com/img/logo-margin/logo-teal.png"
    },
    {
        "name": "Neo4j Graph Database",
        "filename": "3_Neo4j_Logo.png",
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Neo4j-logo_color.png/600px-Neo4j-logo_color.png"
    },
    {
        "name": "Supabase PostgreSQL",
        "filename": "4_Supabase_Logo.png",
        "url": "https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-icon.png"
    },
    {
        "name": "Blockchain & Hyperledger",
        "filename": "5_Blockchain_Hyperledger_Logo.png",
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Hyperledger_Fabric_Logo.svg/600px-Hyperledger_Fabric_Logo.svg.png"
    },
    {
        "name": "Leaflet GeoIP Mapping",
        "filename": "6_Leaflet_Logo.png",
        "url": "https://leafletjs.com/docs/images/logo.png"
    },
    {
        "name": "React 18",
        "filename": "7_React_Logo.png",
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/React-icon.svg/600px-React-icon.svg.png"
    },
    {
        "name": "Vite",
        "filename": "8_Vite_Logo.png",
        "url": "https://vitejs.dev/logo.svg" # will check if png exists or fallback
    },
    {
        "name": "TailwindCSS",
        "filename": "9_TailwindCSS_Logo.png",
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Tailwind_CSS_Logo.svg/600px-Tailwind_CSS_Logo.svg.png"
    },
    {
        "name": "MITRE ATT&CK",
        "filename": "10_MITRE_ATTACK_Logo.png",
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Mitre_Corporation_logo.svg/600px-Mitre_Corporation_logo.svg.png"
    },
    {
        "name": "Cloudflare Zero-Trust",
        "filename": "11_Cloudflare_Logo.png",
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Cloudflare_Logo.png/600px-Cloudflare_Logo.png"
    },
    {
        "name": "PostgreSQL",
        "filename": "12_PostgreSQL_Logo.png",
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Postgresql_elephant.svg/600px-Postgresql_elephant.svg.png"
    }
]

# Additional fallbacks for Vite & others
vite_png = "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Vitejs-logo.svg/600px-Vitejs-logo.svg.png"
verified_tools[7]["url"] = vite_png

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

print(f"📦 Generating 12 official technology logos with solid white backgrounds in: {output_dir}")

for t in verified_tools:
    name = t["name"]
    filename = t["filename"]
    out_path = os.path.join(output_dir, filename)
    tmp_path = os.path.join("/tmp", f"raw_{filename}")
    
    try:
        req = urllib.request.Request(t["url"], headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp, open(tmp_path, 'wb') as f:
            f.write(resp.read())
            
        orig = Image.open(tmp_path).convert("RGBA")
        
        # Canvas 600x600 solid pure white
        canvas_size = (600, 600)
        card = Image.new("RGBA", canvas_size, (255, 255, 255, 255))
        
        # Max dimensions inside white square: 440x440
        w, h = orig.size
        scale = min(440.0 / w, 440.0 / h)
        new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
        resized = orig.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        offset_x = (canvas_size[0] - new_w) // 2
        offset_y = (canvas_size[1] - new_h) // 2
        
        # Composite logo over solid white
        card.paste(resized, (offset_x, offset_y), resized)
        
        # Save as high-res RGB PNG
        final_img = card.convert("RGB")
        final_img.save(out_path, "PNG", quality=98)
        print(f"  ✅ {filename} -> Created successfully ({name})")
        
    except Exception as e:
        print(f"  ❌ Error fetching {name}: {e}")

print("\n🎉 Completed! Checking files on Desktop:")
for f in sorted(os.listdir(output_dir)):
    size_kb = os.path.getsize(os.path.join(output_dir, f)) / 1024
    print(f"  📁 {f} ({size_kb:.1f} KB)")
