#!/usr/bin/env python3
"""
Importa el ranking 2025 directamente a Supabase vía REST API.
Uso: python3 importar-ranking-api.py <SERVICE_ROLE_KEY>

La service_role key la encuentras en:
  Supabase → Settings → API → Project API keys → service_role
"""
import xlrd, glob, os, re, sys, json, time
try:
    import urllib.request as req
except ImportError:
    print("Error: se necesita Python 3"); sys.exit(1)

# ─── CONFIG ──────────────────────────────────────────────────
SUPABASE_URL = "https://bmspwsbhsjkamjywvvde.supabase.co"
CARPETA      = os.path.expanduser("~/Desktop/Ranking 2025")
BATCH        = 200   # registros por petición

if len(sys.argv) < 2:
    print(__doc__)
    sys.exit(1)

SERVICE_KEY = sys.argv[1].strip()

# ─── LEER XLS ────────────────────────────────────────────────
def safe_str(v):
    s = str(v).strip() if v else ''
    if s.endswith('.0') and s[:-2].isdigit():
        s = s[:-2]   # quitar decimales de códigos numéricos
    return s or None

def safe_num(v):
    try: return round(float(v), 3)
    except: return None

def safe_int(v):
    try: return int(float(v))
    except: return None

files = sorted(
    glob.glob(os.path.join(CARPETA, "*.xls")),
    key=lambda x: int(re.search(r'-(\d+)\.xls$', x).group(1))
)

print(f"Leyendo {len(files)} archivos XLS...")
registros = []
for f in files:
    wb = xlrd.open_workbook(f)
    ws = wb.sheet_by_index(0)
    for i in range(1, ws.nrows):
        r = [ws.cell_value(i, j) for j in range(ws.ncols)]
        if not r[4]: continue
        registros.append({
            "anio":               2025,
            "puesto_anio":        safe_int(r[1]),
            "puesto_periodo":     safe_int(r[2]),
            "codigo":             safe_str(r[3]),
            "nombre":             safe_str(r[4]),
            "departamento":       safe_str(r[5]),
            "ciudad":             safe_str(r[6]),
            "calendario":         safe_str(r[7]),
            "naturaleza":         safe_str(r[8]),
            "jornada":            safe_str(r[9]),
            "eval_estudiantes":   safe_int(r[10]),
            "lectura_critica":    safe_num(r[11]),
            "matematicas":        safe_num(r[12]),
            "ciencias_sociales":  safe_num(r[13]),
            "ciencias_naturales": safe_num(r[14]),
            "ingles":             safe_num(r[15]),
            "ponderado":          safe_num(r[16]),
            "puntaje_global":     safe_int(r[17]),
        })

print(f"Total registros leídos: {len(registros)}")

# ─── INSERTAR VÍA API ────────────────────────────────────────
endpoint = f"{SUPABASE_URL}/rest/v1/ranking_colegios"
headers = {
    "apikey":        SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "resolution=ignore-duplicates",
}

batches     = [registros[i:i+BATCH] for i in range(0, len(registros), BATCH)]
total_ok    = 0
total_err   = 0

print(f"Enviando {len(batches)} batches de {BATCH} registros...\n")

for idx, batch in enumerate(batches):
    body  = json.dumps(batch).encode('utf-8')
    request = req.Request(endpoint, data=body, headers=headers, method='POST')
    try:
        with req.urlopen(request, timeout=30) as resp:
            status = resp.status
            total_ok += len(batch)
            print(f"  Batch {idx+1:02d}/{len(batches)} → {status} OK  ({total_ok} acumulados)")
    except Exception as e:
        total_err += len(batch)
        print(f"  Batch {idx+1:02d}/{len(batches)} → ERROR: {e}")
    time.sleep(0.1)  # respetar rate limit

print(f"\n{'='*50}")
print(f"✅ Completado: {total_ok} registros importados.")
if total_err:
    print(f"⚠️  {total_err} registros fallaron.")
print(f"{'='*50}")
