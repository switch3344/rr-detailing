import bpy,bmesh,math,json,os
root=os.getcwd()
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=os.path.join(root,'artifacts/normal-test/input.glb'))
report=[]
for obj in list(bpy.context.scene.objects):
 if obj.type!='MESH' or not any(k in obj.name for k in ['bodyshell','bumper_f','door_']):continue
 if not any(m and m.name.startswith('Material.') for m in obj.data.materials):continue
 before={tuple(round(float(c),6) for c in v.co) for v in obj.data.vertices}
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
 bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
 for e in bm.edges:
  if len(e.link_faces)==2:e.smooth=e.calc_face_angle()<math.radians(35)
 for f in bm.faces:f.smooth=True
 bm.to_mesh(obj.data);bm.free();obj.data.update()
 try:
  mod=obj.modifiers.new('Angle-preserving weighted normals','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=50;mod.mode='FACE_AREA_WITH_ANGLE';bpy.ops.object.modifier_apply(modifier=mod.name)
  result='weighted normals applied'
 except Exception as ex:result=str(ex)
 after={tuple(round(float(c),6) for c in v.co) for v in obj.data.vertices}
 report.append({'node':obj.name,'result':result,'positionSetUnchanged':before==after,'vertices':len(obj.data.vertices)})
bpy.ops.export_scene.gltf(filepath=os.path.join(root,'artifacts/normal-test/weighted-raw.glb'),export_format='GLB',export_extras=True,export_normals=True,export_image_format='AUTO')
with open(os.path.join(root,'artifacts/normal-test/blender-report.json'),'w') as f:json.dump(report,f,indent=2)
