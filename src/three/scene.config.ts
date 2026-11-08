import legacy from './car-config.json'
export const sceneConfig={
 site:{...legacy.site,css:{...legacy.site.css,'--ink':'#07090d','--tone':'#0e1218','--surface':'#141a22','--text':'#e7ebf2','--muted':'#a0aab8','--studio-halo':'#1e334f','--studio-floor':'#10151c','--noise-opacity':'.025','--hero-halo':'#20395666','--body-surface':'#0b0f15','--body-halo':'#233c571f','--engine-halo':'#33465a24','--tuning-surface':'#0a0d12','--tuning-halo':'#45403a20','--vignette':'#07090d80'}},
 lighting:{...legacy.lighting,ambient:.16,key:.8,rim:1.6,exposure:1.12,background:'#030508',environmentIntensity:1.05,
  strips:[
   {position:[-1.3,5,2],scale:[6,1.1,1],intensity:5,color:'#f0f3f8'},
   {position:[1.2,3.8,-2.4],scale:[6.5,.23,1],intensity:7,color:'#cedff4'},
   {position:[0,2.5,4],scale:[7,.18,1],intensity:8,color:'#e7edf7'},
   {position:[-.8,.65,3.5],scale:[6,.1,1],intensity:3,color:'#cddbed'},
   {position:[3,2,-3],scale:[.45,2,1],intensity:4,color:'#a9c6ee'},
  ]},
 floor:{...legacy.floor,reflectionOpacity:.12,reflectionStrength:.8,color:'#0b1018',roughness:.5,shadowOpacity:.64},
 loader:{minimumMs:700,timeoutMs:12000,exitMs:800,desktopBytes:6888680,mobileBytes:3795420,heroWeight:.78,fontWeight:.08,imageWeight:.04,frameWeight:.10},
 performance:{...legacy.performance,desktopDpr:1.75,mobileDpr:1.5,targetFps:55},
 proximity:{screens:1.6},
} 
