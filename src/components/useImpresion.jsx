// Impresión de hojas de resultados: monta el contenido en #print-root (fuera de pantalla),
// espera a que el navegador lo pinte y recién ahí abre el diálogo de impresión.
//
// Por qué esperar al pintado: window.print() es SÍNCRONO y captura el DOM tal como está en ese
// instante. Si se llama en el mismo tick en que se piden las hojas, React todavía no las ha
// montado y el diálogo sale en blanco. Por eso dos requestAnimationFrame anidados: el primero
// corre antes del pintado del commit, el segundo ya después.
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

function raizImpresion() {
  let el = document.getElementById('print-root')
  if (!el) {
    el = document.createElement('div')
    el.id = 'print-root'
    document.body.appendChild(el)
  }
  return el
}

export function useImpresion() {
  const [contenido, setContenido] = useState(null)
  const imprimir = useCallback(nodo => setContenido(nodo), [])

  useEffect(() => {
    if (!contenido) return
    let cancelado = false
    const limpiar = () => { if (!cancelado) setContenido(null) }
    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      if (cancelado) return
      window.addEventListener('afterprint', limpiar, { once: true })
      window.print()
      // Safari no siempre dispara 'afterprint'; sin este respaldo las hojas quedarían montadas
      // para siempre y el siguiente clic imprimiría las de dos estudiantes a la vez.
      setTimeout(limpiar, 1500)
    }))
    return () => {
      cancelado = true
      cancelAnimationFrame(id)
      window.removeEventListener('afterprint', limpiar)
    }
  }, [contenido])

  const portal = contenido ? createPortal(contenido, raizImpresion()) : null
  return { imprimir, portal, imprimiendo: !!contenido }
}
