#!/usr/bin/env python3
"""
Importa clasificación de planteles ICFES (Saber 11) hacia Supabase.

Uso:
  pip install requests beautifulsoup4 supabase
  python3 importar-clasificacion-icfes.py

Variables de entorno requeridas:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

import os, re, time
import requests
from bs4 import BeautifulSoup
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

ICFES_URL = (
    'https://resultados.icfes.edu.co/resultados-saber2016-web/'
    'pages/publicacionResultados/agregados/saber11/clasificacionPlanteles.jsf'
)

# Combinaciones a importar: (año, periodo, grado)
COMBINACIONES = [
    (2020, 1, 11),
    (2021, 1, 11),
    (2022, 1, 11),
    (2022, 4, 11),
    (2023, 1, 11),
    (2024, 1, 11),
    (2025, 1, 11),
    (2020, 1, 26),
    (2021, 1, 26),
    (2022, 1, 26),
    (2023, 1, 26),
    (2024, 1, 26),
    (2025, 1, 26),
]

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-CO,es;q=0.9',
}


def get_session_and_page():
    """GET inicial: obtiene cookies + ViewState + IDs de campos."""
    s = requests.Session()
    s.headers.update(HEADERS)
    resp = s.get(ICFES_URL, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, 'html.parser')

    # ViewState
    vs_tag = soup.find('input', {'name': 'javax.faces.ViewState'})
    view_state = vs_tag['value'] if vs_tag else None

    # Form ID
    form = soup.find('form')
    form_id = form.get('id', 'form') if form else 'form'

    # Extraer todos los selects con sus opciones
    selects = {}
    for sel in soup.find_all('select'):
        name = sel.get('name') or sel.get('id', '')
        opts = [{'value': o.get('value',''), 'text': o.get_text(strip=True)}
                for o in sel.find_all('option')]
        selects[name] = opts

    # Botones submit
    buttons = {b.get('name',''):b for b in soup.find_all('input', {'type':'submit'})}
    buttons.update({b.get('name',''):b for b in soup.find_all('button', {'type':'submit'})})

    print(f"  Form ID: {form_id}")
    print(f"  ViewState: {'OK' if view_state else 'NOT FOUND'}")
    print(f"  Selects encontrados: {list(selects.keys())}")
    print(f"  Botones: {list(buttons.keys())}")

    return s, view_state, form_id, selects, buttons, soup


def find_field(selects, year=None, period=None, grade=None):
    """Identifica los campos por el contenido de sus opciones."""
    anio_field = periodo_field = grado_field = None

    for name, opts in selects.items():
        values = [o['value'] for o in opts]
        texts  = [o['text']  for o in opts]

        # Campo año: contiene años como 2020, 2021, ...
        if year and (str(year) in values or any(str(year) in t for t in texts)):
            if any(str(y) in values or any(str(y) in t for t in texts)
                   for y in [2020, 2021, 2022, 2023, 2024, 2025]):
                anio_field = name

        # Campo período: valores pequeños (1-6)
        if period and str(period) in values and all(
                v == '' or (v.isdigit() and int(v) <= 10) for v in values if v):
            periodo_field = name

        # Campo grado: contiene 11 o 26
        if '11' in values or '26' in values or any('Grado 11' in t or 'Grado 26' in t for t in texts):
            grado_field = name

    return anio_field, periodo_field, grado_field


def submit_filters(s, view_state, form_id, selects, anio, periodo, grado):
    """Envía el formulario con los filtros y retorna la respuesta HTML."""
    anio_field, periodo_field, grado_field = find_field(selects, anio, periodo, grado)

    # Construir body con TODOS los campos del formulario (JSF requiere el estado completo)
    data = {}
    for name, opts in selects.items():
        # Default: first non-empty value
        non_empty = [o['value'] for o in opts if o['value']]
        data[name] = non_empty[0] if non_empty else ''

    # Override con nuestros filtros
    if anio_field:
        data[anio_field] = str(anio)
        print(f"  Año ({anio}) → {anio_field}")
    if periodo_field:
        data[periodo_field] = str(periodo)
        print(f"  Período ({periodo}) → {periodo_field}")
    if grado_field:
        data[grado_field] = str(grado)
        print(f"  Grado ({grado}) → {grado_field}")

    data['javax.faces.ViewState'] = view_state

    # Determinar botón consultar
    consultar_btn = None
    for name in data:
        if 'consultar' in name.lower() or 'buscar' in name.lower():
            consultar_btn = name
            break

    if consultar_btn:
        data[consultar_btn] = data.get(consultar_btn, 'Consultar')

    # También intentar con JSF partial para el botón
    # Buscar botón en la sopa original si lo tenemos
    data[f'{form_id}'] = f'{form_id}'

    resp = s.post(ICFES_URL, data=data, headers={
        **HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': ICFES_URL,
    }, timeout=60)
    return resp.text


def parse_results(html, anio, periodo, grado):
    """Extrae filas de la tabla de resultados."""
    soup = BeautifulSoup(html, 'html.parser')
    records = []

    # Buscar la tabla de resultados — contiene clasificaciones A+/A/B/C/D
    tables = soup.find_all('table')
    result_table = None

    for table in tables:
        text = table.get_text()
        # La tabla de resultados contiene clasificaciones y códigos DANE (12 dígitos)
        if re.search(r'\b[ABC]\+?\b', text) and re.search(r'\d{11,12}', text):
            result_table = table
            break

    if not result_table:
        # Intentar buscar cualquier tabla con datos
        for table in tables:
            rows = table.find_all('tr')
            if len(rows) > 5:  # Al menos 5 filas
                result_table = table
                break

    if not result_table:
        print(f"  ⚠ No se encontró tabla de resultados en la respuesta")
        return []

    rows = result_table.find_all('tr')
    print(f"  Filas encontradas en tabla: {len(rows)}")

    for row in rows:
        cells = [td.get_text(strip=True) for td in row.find_all(['td', 'th'])]
        if len(cells) < 4:
            continue

        # Filtrar encabezados
        if any(h in cells[0].lower() for h in ['código', 'dane', '#', 'institución', 'establecimiento']):
            continue

        # El código DANE es una secuencia numérica larga
        codigo = next((c for c in cells if re.match(r'^\d{9,12}$', c)), None)
        if not codigo:
            continue

        # Clasificación es A+, A, B, C, o D
        clasificacion = next((c for c in cells if re.match(r'^[ABCD]\+?$', c)), None)

        # El nombre del establecimiento es el campo de texto más largo
        nombre = max((c for c in cells if len(c) > 5 and not c.isdigit()
                      and not re.match(r'^[ABCD]\+?$', c)), key=len, default=None)

        # Municipio y departamento son campos de texto medianos
        textos = [c for c in cells if len(c) > 2 and not c.isdigit()
                  and not re.match(r'^[ABCD]\+?$', c) and c != nombre]

        municipio    = textos[0] if len(textos) > 0 else None
        departamento = textos[1] if len(textos) > 1 else None
        sector       = next((c for c in textos if c in ['OFICIAL','NO OFICIAL']), None)

        # Números: evaluados y puntaje
        numeros = [c for c in cells if re.match(r'^\d+\.?\d*$', c) and c != codigo]
        num_evaluados  = int(numeros[0])    if numeros and numeros[0].isdigit() else None
        puntaje_global = float(numeros[-1]) if len(numeros) > 1 else None

        records.append({
            'anio':          anio,
            'periodo':       periodo,
            'grado':         grado,
            'codigo_dane':   codigo,
            'nombre_sede':   nombre,
            'municipio':     municipio,
            'departamento':  departamento,
            'sector':        sector,
            'clasificacion': clasificacion,
            'num_evaluados': num_evaluados,
            'puntaje_global':puntaje_global,
        })

    return records


def upsert_records(sb, records):
    """Inserta/actualiza registros en Supabase."""
    if not records:
        return 0
    BATCH = 500
    total = 0
    for i in range(0, len(records), BATCH):
        batch = records[i:i+BATCH]
        res = sb.table('clasificacion_icfes').upsert(
            batch,
            on_conflict='anio,periodo,grado,codigo_dane,nombre_sede'
        ).execute()
        total += len(batch)
        print(f"  Insertados {total}/{len(records)} registros...")
    return total


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY")
        return

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("Conectado a Supabase OK")

    for anio, periodo, grado in COMBINACIONES:
        label = f"{anio} P{periodo} G{grado}"
        print(f"\n{'='*50}")
        print(f"Importando: {label}")
        print(f"{'='*50}")

        try:
            s, view_state, form_id, selects, buttons, _ = get_session_and_page()

            if not view_state:
                print(f"  ✗ Sin ViewState, saltando {label}")
                continue

            print(f"  Enviando filtros...")
            result_html = submit_filters(s, view_state, form_id, selects, anio, periodo, grado)

            print(f"  Parseando resultados...")
            records = parse_results(result_html, anio, periodo, grado)
            print(f"  Registros parseados: {len(records)}")

            if records:
                n = upsert_records(sb, records)
                print(f"  ✓ {n} registros guardados para {label}")
            else:
                print(f"  ⚠ Sin registros para {label}")

        except Exception as e:
            print(f"  ✗ Error en {label}: {e}")

        # Pausa para no saturar ICFES
        time.sleep(3)

    print("\n✓ Importación completada")


if __name__ == '__main__':
    main()
