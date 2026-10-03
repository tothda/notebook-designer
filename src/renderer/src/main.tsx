import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/caveat/400.css'
import '@fontsource/caveat/700.css'
import '@fontsource/patrick-hand/400.css'
import '@fontsource/kalam/400.css'
import '@fontsource/kalam/700.css'
import '@fontsource/shadows-into-light/400.css'
import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

import { FONTS } from '@shared/palette'

const fontsLoaded = Promise.all(
  FONTS.flatMap((f) => [document.fonts.load(`400 16px "${f.family}"`), document.fonts.load(`700 16px "${f.family}"`)])
).catch(() => undefined)

void fontsLoaded.then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
)
