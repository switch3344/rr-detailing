import legacy from './car-config.json'
import {sceneConfig} from './scene.config'
const carConfig={...legacy,site:sceneConfig.site,lighting:sceneConfig.lighting,floor:sceneConfig.floor,performance:sceneConfig.performance,
 pose:{...legacy.pose,steerAngle:0},
 materials:{...legacy.materials,
  paint:{...legacy.materials.paint,color:'#8695a4',metalness:.65,roughness:.36,clearcoat:1,clearcoatRoughness:.035,envMapIntensity:.9,normalScale:0},
  rim:{...legacy.materials.rim,color:'#343c46',metalness:.8,roughness:.34,envMapIntensity:.85,anisotropy:.25},
  rubber:{...legacy.materials.rubber,color:'#454951',roughness:.85,envMapIntensity:.3},
  glass:{...legacy.materials.glass,color:'#b4c0ce',roughness:.035,transmission:0,opacity:.08,ior:1.5,envMapIntensity:.38},
  leather:{...legacy.materials.leather,color:'#151a21',roughness:.86,envMapIntensity:.2},
  caliper:{...legacy.materials.caliper,color:'#d6ac24',roughness:.22,clearcoat:1},
  carbon:{color:'#20252c',roughness:.34,metalness:.35,clearcoat:.8,clearcoatRoughness:.07,normalScale:.08,repeat:80},
 },
 geometry:{...legacy.geometry,creaseAngle:35,weldTolerance:.00001},
}
export default carConfig
