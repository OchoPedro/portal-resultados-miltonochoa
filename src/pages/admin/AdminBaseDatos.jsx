import { useState } from 'react'
import { C } from '../../components/ui'
import AdminColegios from './AdminColegios'
import AdminEstudiantesOrganizados from './AdminEstudiantesOrganizados'
import AdminColaboradores from './AdminColaboradores'

const SUBTABS = [
  { id: 'colegios',      label: 'Colegios',      icon: '🏫' },
  { id: 'estudiantes',   label: 'Estudiantes',   icon: '👥' },
  { id: 'colaboradores', label: 'Colaboradores', icon: '🤝' },
]

export default function AdminBaseDatos({ onUpdate }) {
  const [sub, setSub] = useState('colegios')

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        background: C.bg, borderRadius: 10, padding: 4,
        border: `1px solid ${C.grayLt}`, width: 'fit-content',
      }}>
        {SUBTABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)} style={{
            padding: '8px 20px', borderRadius: 7, border: 'none',
            fontFamily: 'Inter', fontSize: 13,
            fontWeight: sub === t.id ? 600 : 400,
            background: sub === t.id ? C.white : 'transparent',
            color: sub === t.id ? C.navy : C.gray,
            cursor: 'pointer', transition: 'all 0.15s',
            boxShadow: sub === t.id ? '0 1px 4px rgba(10,31,61,0.10)' : 'none',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {sub === 'colegios'      && <AdminColegios            onUpdate={onUpdate} />}
      {sub === 'estudiantes'   && <AdminEstudiantesOrganizados />}
      {sub === 'colaboradores' && <AdminColaboradores />}
    </div>
  )
}
