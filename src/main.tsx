import { createRoot } from 'react-dom/client'
import './fonts.css'
import './styles.css'
import App from './App'
import visual from './three/car.config'

for(const [name,value] of Object.entries(visual.site.css))document.documentElement.style.setProperty(name,String(value))

if(import.meta.env.DEV&&location.pathname==='/debug/car') {
  import('./dev/DebugCar').then(({default:DebugCar})=>createRoot(document.getElementById('root')!).render(<DebugCar/>))
} else createRoot(document.getElementById('root')!).render(<App />)
if(import.meta.env.DEV && new URLSearchParams(location.search).get('qa')==='scroll') {
  const script=document.createElement('script')
  script.src='/artifacts/stage4/scroll-driver.js'
  document.body.append(script)
}
