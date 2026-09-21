import os
import urllib.request
import json
from PIL import Image, ImageDraw, ImageFont

output_dir = "/home/nee/Desktop/sih_tech_logos"
os.makedirs(output_dir, exist_ok=True)

# List of all tools and high-res official logo source URLs
tools = [
    {
        "name": "Python",
        "filename": "1_python_logo.png",
        "url": "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/python/python.png"
    },
    {
        "name": "FastAPI",
        "filename": "2_fastapi_logo.png",
        "url": "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/fastapi/fastapi.png"
    },
    {
        "name": "Neo4j",
        "filename": "3_neo4j_logo.png",
        "url": "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/neo4j/neo4j.png"
    },
    {
        "name": "Supabase",
        "filename": "4_supabase_logo.png",
        "url": "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/supabase/supabase.png"
    },
    {
        "name": "Blockchain / Ethereum",
        "filename": "5_blockchain_ethereum_logo.png",
        "url": "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/ethereum/ethereum.png"
    },
    {
        "name": "Leaflet.js",
        "filename": "6_leaflet_logo.png",
        "url": "https://leafletjs.com/docs/images/logo.png"
    },
    {
        "name": "React",
        "filename": "7_react_logo.png",
        "url": "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/react/react.png"
    },
    {
        "name": "Vite",
        "filename": "8_vite_logo.png",
        "url": "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/vite/vite.png"
    },
    {
        "name": "TailwindCSS",
        "filename": "9_tailwindcss_logo.png",
        "url": "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/tailwind/tailwind.png"
    },
    {
        "name": "Cloudflare",
        "filename": "10_cloudflare_logo.png",
        "url": "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/cloudflare/cloudflare.png"
    },
    {
        "name": "PostgreSQL",
        "filename": "11_postgresql_logo.png",
        "url": "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/postgresql/postgresql.png"
    }
]

print("Downloading and generating high-res logos with pure white background...")

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

for tool in tools:
    name = tool["name"]
    filename = tool["filename"]
    out_path = os.path.join(output_dir, filename)
    tmp_path = os.path.join("/tmp", f"tmp_{filename}")
    
    try:
        req = urllib.request.Request(tool["url"], headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response, open(tmp_path, 'wb') as out_file:
            out_file.write(response.read())
        
        # Load downloaded logo and compose onto a high-res white card
        orig = Image.open(tmp_path).convert("RGBA")
        
        # Target canvas size: 600x600 pure white square
        canvas_size = (600, 600)
        card = Image.new("RGBA", canvas_size, (255, 255, 255, 255))
        
        # Resize logo to fit nicely within 420x420 while maintaining aspect ratio
        max_logo_dim = 420
        w, h = orig.size
        scale = min(max_logo_dim / w, max_logo_dim / h)
        new_w, new_h = int(w * scale), int(h * scale)
        resized_logo = orig.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        # Center logo on the white card
        offset_x = (canvas_size[0] - new_w) // 2
        offset_y = (canvas_size[1] - new_h) // 2
        
        card.paste(resized_logo, (offset_x, offset_y), resized_logo)
        
        # Save as solid RGB JPEG/PNG with white background
        final_img = card.convert("RGB")
        final_img.save(out_path, "PNG", quality=95)
        print(f"✅ Generated: {filename} ({name})")
        
    except Exception as e:
        print(f"⚠️ Fallback generating badge for {name}: {e}")
        # Generate clean graphic placeholder with white background
        card = Image.new("RGB", (600, 600), (255, 255, 255))
        draw = ImageDraw.Draw(card)
        draw.rectangle([20, 20, 580, 580], outline=(220, 225, 230), width=4)
        draw.text((150, 270), name, fill=(30, 41, 59))
        card.save(out_path, "PNG")

print(f"\n🎉 All logos successfully saved to: {output_dir}")
