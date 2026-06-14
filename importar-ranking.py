#!/usr/bin/env python3
"""
Genera el archivo SQL con todos los INSERTs del ranking 2025.
Uso: python3 importar-ranking.py
Luego ejecuta el .sql resultante en el SQL Editor de Supabase.
"""
import xlrd, glob, os, re

CARPETA = os.path.expanduser("~/Desktop/Ranking 2025")
SALIDA  = os.path.join(os.path.dirname(__file__), "ranking-2025-import.sql")

def esc(v):
    if v is None or v == '':
        return 'NULL'
    s = str(v).strip().replace("'", "''")
    return f"'{s}'"

def num(v):
    try:
        f = float(v)
        return str(round(f, 3))
    except:
        return 'NULL'

def entero(v):
    try:
        return str(int(float(v)))
    except:
        return 'NULL'

files = sorted(
    glob.glob(os.path.join(CARPETA, "*.xls")),
    key=lambda x: int(re.search(r'-(\d+)\.xls$', x).group(1))
)

print(f"Procesando {len(files)} archivos...")

rows_sql = []
for f in files:
    wb = xlrd.open_workbook(f)
    ws = wb.sheet_by_index(0)
    for i in range(1, ws.nrows):
        r = [ws.cell_value(i, j) for j in range(ws.ncols)]
        if not r[4]:  # sin nombre → saltar
            continue
        row = (
            f"(2025,"
            f"{entero(r[1])},"   # puesto_anio
            f"{entero(r[2])},"   # puesto_periodo
            f"{esc(str(r[3]).split('.')[0] if r[3] else '')},"  # codigo (sin decimales)
            f"{esc(r[4])},"      # nombre
            f"{esc(r[5])},"      # departamento
            f"{esc(r[6])},"      # ciudad
            f"{esc(r[7])},"      # calendario
            f"{esc(r[8])},"      # naturaleza
            f"{esc(r[9])},"      # jornada
            f"{entero(r[10])},"  # eval_estudiantes
            f"{num(r[11])},"     # lectura_critica
            f"{num(r[12])},"     # matematicas
            f"{num(r[13])},"     # ciencias_sociales
            f"{num(r[14])},"     # ciencias_naturales
            f"{num(r[15])},"     # ingles
            f"{num(r[16])},"     # ponderado
            f"{entero(r[17])}"   # puntaje_global
            f")"
        )
        rows_sql.append(row)
    print(f"  {os.path.basename(f)}: {ws.nrows-1} registros")

CHUNK = 500
chunks = [rows_sql[i:i+CHUNK] for i in range(0, len(rows_sql), CHUNK)]

with open(SALIDA, 'w', encoding='utf-8') as out:
    out.write("-- Ranking Colegios Colombia 2025 - Saber 11\n")
    out.write("-- Importar en el SQL Editor de Supabase\n\n")
    for idx, chunk in enumerate(chunks):
        out.write(
            "INSERT INTO ranking_colegios "
            "(anio,puesto_anio,puesto_periodo,codigo,nombre,departamento,ciudad,"
            "calendario,naturaleza,jornada,eval_estudiantes,lectura_critica,"
            "matematicas,ciencias_sociales,ciencias_naturales,ingles,ponderado,puntaje_global)\n"
            "VALUES\n"
        )
        out.write(",\n".join(chunk))
        out.write("\nON CONFLICT (anio, codigo) DO NOTHING;\n\n")

print(f"\n✅ Archivo generado: {SALIDA}")
print(f"   {len(rows_sql)} registros en {len(chunks)} bloques de {CHUNK}")
print(f"   Tamaño: {os.path.getsize(SALIDA)/1024/1024:.1f} MB")
print("\nPasos siguientes:")
print("  1. Ejecuta primero ranking-tabla.sql en Supabase")
print("  2. Luego ejecuta ranking-2025-import.sql en el SQL Editor")
